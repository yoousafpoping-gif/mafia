import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PORT = Number(process.env.SMOKE_PORT ?? 4311);
const URL = `http://localhost:${PORT}`;
const NAMES = ['Vito', 'Sonny', 'Michael', 'Fredo', 'Connie', 'Tom', 'Luca'];
const SERVER_ENV = {
  ...process.env,
  PORT: String(PORT),
  LOG_LEVEL: 'info',
  NIGHT_MS: '6000',
  DAY_DISCUSSION_MS: '2500',
  DAY_VOTING_MS: '4000',
  REVENGE_MS: '4000',
  LAST_WORDS_MS: '1500',
  DEFENSE_TIME: '1200',
};

const knownRoles = new Map();
const idOfRole = (role) => [...knownRoles.entries()].find(([, r]) => r === role)?.[0] ?? null;
const livingPlayer = (state, playerId) => state.players.find((p) => p.id === playerId && p.isAlive);

const log = (...args) => console.log('[smoke]', ...args);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ['websocket'], reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(new Error(`connect failed: ${err.message}`)));
  });
}

function emitAck(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout on ${event}`)), 6000);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      if (!res?.ok) {
        reject(Object.assign(new Error(`${event} rejected: ${JSON.stringify(res?.error ?? res)}`), {
          code: res?.error?.code,
        }));
        return;
      }
      resolve(res.data);
    });
  });
}

function expectError(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no response from ${event}`)), 6000);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      if (res && !res.ok && res.error?.code) resolve(res.error.code);
      else reject(new Error(`expected ${event} to fail, got ${JSON.stringify(res)}`));
    });
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const res = await fetch(`${URL}/health`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('server never became healthy');
}

function wireBot(bot, bots, seenPhases) {
  bot.socket.on('game:started', (state) => {
    bot.role = state.you.role;
    bot.team = state.you.team;
    knownRoles.set(state.you.id, state.you.role);
    log(`${bot.name} drew role ${bot.role} (${state.you.team})`);
  });

  bot.socket.on('phase:change', ({ phase }) => {
    seenPhases.add(phase);
    if (phase === 'NIGHT') void botNight(bot);
    if (phase === 'DAY_VOTING') void botVote(bot);
  });

  bot.socket.on('good_boy:prompt', async () => {
    await sleep(120);
    try {
      const { state } = await emitAck(bot.socket, 'game:sync');
      const optionIds = new Set(state.players.filter((p) => p.isAlive).map((p) => p.id));
      const preferred =
        ['MAFIA_BOSS', 'SILENCER'].map(idOfRole).find((id) => id && optionIds.has(id)) ??
        state.players.find((p) => p.isAlive && p.id !== state.you.id)?.id ??
        null;
      await emitAck(bot.socket, 'action:good_boy_revenge', { targetId: preferred });
      log(`${bot.name} takes revenge on ${preferred ?? 'nobody'}`);
    } catch (error) {
      log(`revenge failed for ${bot.name}:`, error.message);
    }
  });

  bot.socket.on('action:error', (payload) => {
    log(`action:error for ${bot.name}: ${payload.code}`);
  });
}

async function botNight(bot) {
  await sleep(200 + Math.random() * 250);
  try {
    const { state } = await emitAck(bot.socket, 'game:sync');
    if (state.phase !== 'NIGHT' || !state.you.isAlive || state.awaitingRevenge) return;
    if (!state.you.ability || state.you.hasSubmittedNightAction) return;

    const others = state.players.filter((p) => p.isAlive && p.id !== state.you.id);
    let targetId = null;

    switch (state.you.role) {
      case 'MAFIA_BOSS': {
        const medic = livingPlayer(state, idOfRole('MEDIC'));
        targetId = (medic?.id) ?? others[0]?.id ?? null;
        break;
      }
      case 'SILENCER': {
        const mayor = livingPlayer(state, idOfRole('MAYOR'));
        targetId = (mayor?.id) ?? others[0]?.id ?? null;
        break;
      }
      case 'MEDIC':
        targetId = state.you.id;
        break;
      case 'SNIPER': {
        const silencer = livingPlayer(state, idOfRole('SILENCER'));
        targetId = state.you.bulletsLeft > 0 && silencer ? silencer.id : null;
        break;
      }
      default:
        return;
    }

    await emitAck(bot.socket, 'action:night_ability', { targetId });
    log(`${bot.name} (${state.you.role}) acted -> ${targetId ?? 'skip'}`);
  } catch (error) {
    log(`night action issue for ${bot.name}: ${error.message}`);
  }
}

async function botVote(bot) {
  await sleep(200 + Math.random() * 250);
  try {
    const { state } = await emitAck(bot.socket, 'game:sync');
    if (state.phase !== 'DAY_VOTING' || !state.you.isAlive || state.awaitingRevenge) return;
    if (state.you.voteTarget) return;

    let targetId = null;
    for (const role of ['GOOD_BOY', 'SILENCER', 'MAFIA_BOSS']) {
      const candidate = livingPlayer(state, idOfRole(role));
      if (candidate && candidate.id !== state.you.id) {
        targetId = candidate.id;
        break;
      }
    }
    if (!targetId) {
      targetId = state.players.find((p) => p.isAlive && p.id !== state.you.id)?.id ?? null;
    }
    if (!targetId) return;

    await emitAck(bot.socket, 'action:vote', { targetId });
    log(`${bot.name} voted -> ${state.players.find((p) => p.id === targetId)?.name}`);
  } catch (error) {
    log(`vote issue for ${bot.name}: ${error.message}`);
  }
}

async function runErrorChecks(sockets) {
  log('running invalid-move checks...');
  const probe = await connect();
  sockets.push(probe);

  const badRoom = await expectError(probe, 'room:join', { code: 'ZZZZZZ', name: 'Wanderer' });
  if (badRoom !== 'ROOM_NOT_FOUND') throw new Error(`expected ROOM_NOT_FOUND, got ${badRoom}`);

  const shortName = await expectError(probe, 'room:create', { name: 'A' });
  if (shortName !== 'VALIDATION_ERROR') throw new Error(`expected VALIDATION_ERROR, got ${shortName}`);

  const solo = await emitAck(probe, 'room:create', { name: 'Loner' });
  const notEnough = await expectError(probe, 'game:start');
  if (notEnough !== 'NOT_ENOUGH_PLAYERS') throw new Error(`expected NOT_ENOUGH_PLAYERS, got ${notEnough}`);

  const dup = await connect();
  sockets.push(dup);
  const dupName = await expectError(dup, 'room:join', { code: solo.code, name: 'Loner' });
  if (dupName !== 'NAME_TAKEN') throw new Error(`expected NAME_TAKEN, got ${dupName}`);

  const outsider = await connect();
  sockets.push(outsider);
  await emitAck(outsider, 'room:join', { code: solo.code, name: 'Outsider' });
  const notHost = await expectError(outsider, 'game:start');
  if (notHost !== 'HOST_ONLY') throw new Error(`expected HOST_ONLY, got ${notHost}`);
  const badTarget = await expectError(probe, 'action:vote', { targetId: 'nope' });
  if (badTarget !== 'PHASE_INVALID') throw new Error(`expected PHASE_INVALID, got ${badTarget}`);

  log('invalid-move checks passed');

  await runBotCheck(sockets);
}

async function runBotCheck(sockets) {
  log('running bot match check...');
  const host = await connect();
  sockets.push(host);
  const created = await emitAck(host, 'room:create', { name: 'البوتير' });
  const code = created.code;

  const notHost = await connect();
  sockets.push(notHost);
  await emitAck(notHost, 'room:join', { code, name: 'زائر' });
  const denied = await expectError(notHost, 'game:add_bot', { count: 1 });
  if (denied !== 'HOST_ONLY') throw new Error(`expected HOST_ONLY for add_bot, got ${denied}`);

  for (let i = 0; i < 3; i += 1) {
    await emitAck(host, 'game:add_bot', { count: 1 });
  }
  const lobby = await emitAck(host, 'game:sync');
  const botSeats = lobby.state.players.filter((p) => p.isBot);
  if (lobby.state.players.length !== 5) throw new Error(`expected 5 seats with bots, got ${lobby.state.players.length}`);
  if (botSeats.length !== 3) throw new Error(`expected 3 bot seats, got ${botSeats.length}`);
  log(`bots seated: ${botSeats.map((p) => p.name).join(', ')}`);

  const dayArrived = Promise.withResolvers();
  const dayTimeout = setTimeout(() => dayArrived.reject(new Error('bots never reached DAY_DISCUSSION')), 30_000);
  host.on('phase:change', (info) => {
    if (info.phase === 'DAY_DISCUSSION' && info.round === 1) {
      clearTimeout(dayTimeout);
      dayArrived.resolve(info);
    }
  });

  await emitAck(host, 'game:start');
  const day = await dayArrived.promise;
  const afterNight = await emitAck(host, 'game:sync');
  const botActionsTaken = afterNight.state.phase === 'DAY_DISCUSSION';
  if (!botActionsTaken) throw new Error('unexpected post-night phase');
  log(`bot night resolved without human input -> ${day.phase} round ${day.round}`);
}

async function main() {
  const sockets = [];
  let server;
  try {
    server = spawn(process.execPath, ['server/index.js'], {
      env: SERVER_ENV,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    server.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        log(`server exited unexpectedly with code ${code} (${signal})`);
      }
    });

    await waitForHealth();
    log(`server healthy on ${URL}`);

    await runErrorChecks(sockets);

    const bots = [];
    for (const name of NAMES) {
      const socket = await connect();
      sockets.push(socket);
      bots.push({ name, socket, role: null, team: null });
    }

    const created = await emitAck(bots[0].socket, 'room:create', { name: NAMES[0] });
    const CODE = created.code;
    const seats = [{ botIdx: 0, ...created }];
    for (let i = 1; i < bots.length; i += 1) {
      const joined = await emitAck(bots[i].socket, 'room:join', { code: CODE, name: NAMES[i] });
      seats.push({ botIdx: i, ...joined });
    }
    log(`${bots.length} players seated`);

    const seenPhases = new Set();
    const voiceProbe = await connect();
    sockets.push(voiceProbe);
    const noSeat = await expectError(voiceProbe, 'voice:join');
    if (noSeat !== 'NOT_IN_ROOM') throw new Error(`expected NOT_IN_ROOM for voice:join, got ${noSeat}`);

    for (const bot of bots) {
      bot.vp = { history: [], remote: [], signals: [], peers: [] };
      wireBot(bot, bots, seenPhases);
      bot.socket.on('voice:policy', (policy) => {
        bot.vp.history.push(policy);
      });
      bot.socket.on('voice:peer-joined', ({ socketId }) => {
        bot.vp.remote.push(socketId);
      });
      bot.socket.on('voice:signal', ({ from }) => {
        bot.vp.signals.push(from);
      });
    }

    const gameOver = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('game did not finish within 90s')), 90_000);
      bots[0].socket.on('game:over', (result) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });

    await emitAck(bots[0].socket, 'game:start');
    log('host started the game');

    const rejoinIdx = 3;
    bots[rejoinIdx].socket.disconnect();
    await sleep(300);
    const back = await connect();
    sockets.push(back);
    back.on('voice:policy', (policy) => bots[rejoinIdx].vp.history.push(policy));
    back.on('voice:signal', ({ from }) => bots[rejoinIdx].vp.signals.push(from));
    const rejoinedSeat = await emitAck(back, 'room:join', {
      code: CODE,
      token: seats[rejoinIdx].token,
    });
    if (!rejoinedSeat.rejoined) throw new Error('expected token-based rejoin');
    if (!rejoinedSeat.state.you.role) throw new Error('secret role missing after mid-game rejoin');
    if (rejoinedSeat.state.players.length !== bots.length) throw new Error('rejoin changed player count');
    log(`mid-game rejoin OK for ${NAMES[rejoinIdx]} (${rejoinedSeat.state.you.role})`);
    bots[rejoinIdx].socket = back;
    wireBot(bots[rejoinIdx], bots, seenPhases);

    for (const bot of bots) {
      bot.vp.peers = (await emitAck(bot.socket, 'voice:join')).peers;
    }
    await sleep(400);

    const relayTarget = bots[1].vp.peers[0];
    if (!relayTarget) throw new Error('bots[1] has no relay target');
    await emitAck(bots[1].socket, 'voice:signal', {
      to: relayTarget,
      data: { type: 'offer', sdp: 'smoke-offer' },
    });
    await sleep(250);
    if (!bots[0].vp.signals.includes(bots[1].socket.id)) {
      throw new Error('voice:signal was not relayed to the target peer');
    }
    const badRelay = await expectError(bots[1].socket, 'voice:signal', {
      to: 'ghost-socket',
      data: {},
    });
    if (badRelay !== 'VALIDATION_ERROR') throw new Error(`bad relay gave ${badRelay}`);
    log('voice signaling relay OK');

    const result = await gameOver;
    log(`GAME OVER -> winner=${result.winner}: ${result.reason}`);
    for (const seat of result.roster) {
      log(`  ${seat.name.padEnd(8)} ${seat.isAlive ? 'alive' : 'dead '} ${seat.role}`);
    }

    if (!['MAFIA', 'TOWN', 'NEUTRAL'].includes(result.winner)) throw new Error('unexpected winner value');

    const mafiaSeats = result.roster.filter((seat) =>
      ['MAFIA_BOSS', 'SILENCER', 'MAFIOSO', 'FRAMER'].includes(seat.role),
    );
    const mafiaChannelCount = bots.filter((bot) =>
      bot.vp.history.some((policy) => policy.channel === 'MAFIA'),
    ).length;
    if (mafiaChannelCount !== mafiaSeats.length) {
      throw new Error(`expected ${mafiaSeats.length} mafia voice channels, saw ${mafiaChannelCount}`);
    }

    const silencedPolicySeen = bots.some((bot) =>
      bot.vp.history.some((policy) => policy.channel === 'TOWN' && !policy.canSpeak),
    );
    const townOrDeadSeen = bots.every((bot) =>
      bot.vp.history.some((policy) => policy.channel === 'TOWN' || policy.channel === 'DEAD'),
    );
    const nightMuteSeen = bots.some((bot) =>
      bot.vp.history.some((policy) => policy.channel === 'MUTED'),
    );

    if (!townOrDeadSeen) throw new Error('some player never received a day/dead voice policy');
    // المصفوفة الجديدة مش بتوزع SILENCER في 8 لاعبين — الـsilence-lock بيتفحص بس لو اتصرف
    const hasSilencer = result.roster.some((seat) => seat.role === 'SILENCER');
    if (hasSilencer && !silencedPolicySeen) {
      throw new Error('silencer dealt but no silenced voice policy seen');
    }
    log(`voice policies OK: mafia=${mafiaChannelCount}, silenced-lock=${hasSilencer ? silencedPolicySeen : 'n/a'}, night-mute=${nightMuteSeen}`);
    for (const required of ['NIGHT', 'DAY_DISCUSSION', 'DAY_VOTING']) {
      if (!seenPhases.has(required)) {
        throw new Error(`phases visited incomplete (${[...seenPhases].join(', ')})`);
      }
    }

    const finalState = await emitAck(bots[0].socket, 'game:sync');
    if (finalState.state.phase !== 'GAME_OVER') throw new Error('final state is not GAME_OVER');

    const badRematch = await expectError(voiceProbe, 'room:rematch_vote', { ready: true });
    if (badRematch !== 'NOT_IN_ROOM') throw new Error(`expected NOT_IN_ROOM for outsider rematch vote, got ${badRematch}`);

    const rematchNight = Promise.withResolvers();
    const rematchTimeout = setTimeout(() => rematchNight.reject(new Error('rematch never started')), 30_000);
    bots[0].socket.once('game:started', () => {
      bots[0].socket.once('phase:change', (info) => {
        clearTimeout(rematchTimeout);
        rematchNight.resolve(info);
      });
    });

    const firstVote = await emitAck(bots[0].socket, 'room:rematch_vote', { ready: true });
    if (firstVote.state.phase !== 'GAME_OVER') throw new Error('room ended too early');
    if ((firstVote.state.rematchVotes ?? []).length !== 1) {
      throw new Error('first rematch vote was not tracked');
    }

    const unvote = await emitAck(bots[0].socket, 'room:rematch_vote', { ready: false });
    if ((unvote.state.rematchVotes ?? []).length !== 0) throw new Error('un-vote did not clear readiness');

    for (const bot of bots) await emitAck(bot.socket, 'room:rematch_vote', { ready: true });

    const freshGame = await rematchNight.promise;
    if (freshGame.phase !== 'NIGHT' || freshGame.round !== 1) {
      throw new Error(`expected NIGHT round=1 after unanimous rematch, got ${freshGame.phase} r${freshGame.round}`);
    }
    const freshState = await emitAck(bots[0].socket, 'game:sync');
    if (!freshState.state.you?.role || freshState.state.result) throw new Error('rematch state not clean');
    log(`rematch OK -> ${freshGame.phase} round ${freshGame.round}, everyone re-dealt`);

    log(`phases exercised: ${[...seenPhases].join(' -> ')}`);
    log('SMOKE TEST PASSED');
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (server) {
      server.kill();
      await sleep(400);
      server.kill('SIGKILL');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[smoke] FAILED:', error);
    process.exit(1);
  });

