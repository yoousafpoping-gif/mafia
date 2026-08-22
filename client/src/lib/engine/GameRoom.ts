import { config } from './config';
import { assert, ErrorCodes, GameError } from './errors';
import { logger } from './logger';
import { randomToken } from './random';
import { sanitizeChatText, sanitizeName } from './validate';
import { buildDeck } from './composition';
import {
  DEATH_CAUSES,
  LIMITS,
  NIGHT_ABILITIES,
  PHASES,
  ROLES,
  ROLE_TEAMS,
  TEAMS,
} from './constants';
import { resolveNightActions, type NightOutcome } from './nightResolution';
import { resolveTally, tallyVotes, voteWeightOf } from './voteResolution';
import {
  BOT_DICTIONARY,
  BOT_MENTION_ALIASES,
  BOT_REACTION_COOLDOWN_MS,
  BOT_REACTION_PHASES,
  CHAT_PHASES,
  DAY_PHASES,
  MAYOR_PHASES,
  REACTION_IDS,
} from './botChat';

export interface RoomBus {
  to(target: string | string[]): { emit(event: string, payload: unknown): void };
}

interface Player {
  id: string;
  token: string;
  socketId: string | null;
  name: string;
  isHost: boolean;
  isBot: boolean;
  isConnected: boolean;
  role: string | null;
  team: string | null;
  isAlive: boolean;
  isSilenced: boolean;
  hasRevealed: boolean;
  bulletsLeft: number;
  deathCause: string | null;
  deathRound: number;
}

type ExtraDeath = { id: string; cause: string };

interface RevengeRequest {
  deadPlayer: Player;
  source: string;
  excluded: string[];
  onDone: (extraDeaths: ExtraDeath[]) => void;
}

interface DeathReport {
  id: string;
  name: string;
  role: string | null;
  causes: string[];
}

interface PendingRevenge {
  playerId: string;
  source: string;
  excluded: Set<string>;
  extraDeaths: ExtraDeath[];
  onDone: (extraDeaths: ExtraDeath[]) => void;
}

export class GameRoom {
  bus: RoomBus;
  code: string;
  phase: string;
  round: number;
  createdAt: number;
  lastActivityAt: number;
  phaseEndsAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  players: Map<string, Player>;
  nightActions: Map<string, { ability: string; targetId: string | null }>;
  expectedNightActors: Set<string>;
  votes: Map<string, string>;
  awaitingRevenge: PendingRevenge | null;
  lastBotReactionAt: number;
  rematchVotes: Set<string>;
  voteTally: Map<string, number>;
  botTimers: Set<ReturnType<typeof setTimeout>>;
  result: {
    winner: string;
    reason: string;
    roster: { id: string; name: string; role: string | null; isAlive: boolean; isHost: boolean }[];
  } | null;
  eventLog: { kind: string; text: string; round: number; at: number }[];
  lastWordsPlayerId: string | null;
  defensePlayerId: string | null;
  lastNightDeaths: DeathReport[];
  pendingNightReport: { victim: string | null; silenced: string | null } | null;
  hostId: string;

  constructor(bus: RoomBus, code: string, host: { name: string; socketId: string }) {
    this.bus = bus;
    this.code = code;
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this.phaseEndsAt = null;
    this.timer = null;
    this.players = new Map();
    this.nightActions = new Map();
    this.expectedNightActors = new Set();
    this.votes = new Map();
    this.awaitingRevenge = null;
    this.lastBotReactionAt = 0;
    this.rematchVotes = new Set();
    this.voteTally = new Map();
    this.botTimers = new Set();
    this.result = null;
    this.eventLog = [];
    this.lastWordsPlayerId = null;
    this.defensePlayerId = null;
    this.lastNightDeaths = [];
    this.pendingNightReport = null;

    const hostPlayer = this._createPlayer(host.name, host.socketId);
    hostPlayer.isHost = true;
    this.players.set(hostPlayer.id, hostPlayer);
    this.hostId = hostPlayer.id;
  }

  addPlayer({ name, socketId }: { name: string; socketId: string }): Player {
    assert(
      this.phase === PHASES.LOBBY,
      ErrorCodes.GAME_IN_PROGRESS,
      'This match has already started. Ask the host to restart it after the game ends.',
    );
    assert(
      this.players.size < LIMITS.MAX_PLAYERS,
      ErrorCodes.ROOM_FULL,
      `Room is full (max ${LIMITS.MAX_PLAYERS} players)`,
    );

    const cleanName = sanitizeName(name);
    const nameTaken = [...this.players.values()].some(
      (player) => player.isConnected && player.name.toLowerCase() === cleanName.toLowerCase(),
    );
    assert(!nameTaken, ErrorCodes.NAME_TAKEN, `"${cleanName}" is already seated in this room`);

    const player = this._createPlayer(cleanName, socketId);
    if (![...this.players.values()].some((p) => p.isHost)) {
      player.isHost = true;
      this.hostId = player.id;
    }
    this.players.set(player.id, player);
    this.touch();
    this.broadcastUpdate();
    return player;
  }

  reattach({ token, socketId }: { token: string; socketId: string }): Player {
    assert(
      typeof token === 'string' && token.length > 0,
      ErrorCodes.VALIDATION_ERROR,
      'A valid rejoin token is required',
    );
    const player = [...this.players.values()].find((candidate) => candidate.token === token);
    assert(player, ErrorCodes.VALIDATION_ERROR, 'No seat in this room matches that rejoin token');

    player.socketId = socketId;
    player.isConnected = true;
    const hostAlive = [...this.players.values()].some((p) => p.isHost);
    if (!hostAlive) {
      player.isHost = true;
    }
    this.hostId = [...this.players.values()].find((p) => p.isHost)?.id ?? player.id;
    this.touch();
    this.broadcastUpdate();

    if (
      this.phase === PHASES.NIGHT &&
      !this.awaitingRevenge &&
      this.expectedNightActors.has(player.id) &&
      !this.nightActions.has(player.id)
    ) {
      this._sendNightPrompt(player);
    }
    if (this.awaitingRevenge?.playerId === player.id) {
      this._sendRevengePrompt(player);
    }
    return player;
  }

  handleDisconnect(socketId: string): boolean {
    const player = [...this.players.values()].find((p) => p.socketId === socketId);
    if (!player) return false;

    player.socketId = null;
    player.isConnected = false;

    if (this.phase === PHASES.LOBBY) {
      this.players.delete(player.id);
      if (player.id === this.hostId) {
        const successor = [...this.players.values()].find((p) => p.isConnected);
        if (successor) {
          successor.isHost = true;
          this.hostId = successor.id;
          logger.info(`Host migrated to ${successor.name} in room ${this.code}`);
        }
      }
    } else {
      this.rematchVotes.delete(player.id);

      if (player.id === this.hostId && this.phase === PHASES.GAME_OVER) {
        const successor = [...this.players.values()].find((p) => p.isConnected);
        if (successor) {
          successor.isHost = true;
          this.hostId = successor.id;
          logger.info(`Host migrated to ${successor.name} in room ${this.code}`);
        }
      }

      if (this.phase === PHASES.GAME_OVER && !this.awaitingRevenge) {
        const connected = [...this.players.values()].filter((p) => p.isConnected);
        const unanimous =
          connected.length >= LIMITS.MIN_PLAYERS &&
          connected.every((p) => this.rematchVotes.has(p.id));
        if (unanimous) {
          logger.info(`Room ${this.code}: rematch triggered after departure`);
          this._beginRematch();
          return true;
        }
      }
    }

    this.touch();
    this.broadcastUpdate();
    return true;
  }

  requestPlayAgain(playerId: string): { restarted: boolean; ready?: boolean } {
    assert(
      this.phase === PHASES.GAME_OVER,
      ErrorCodes.PHASE_INVALID,
      'إعادة اللعب متاحة بعد ما اللعبة تخلص بس',
    );
    const requester = this._requirePlayer(playerId);
    const connectedHumans = [...this.players.values()].filter((p) => p.isConnected && !p.isBot);

    if (requester.isHost && connectedHumans.length <= 1) {
      logger.info(`Room ${this.code}: play-again instant restart by host`);
      this._beginRematch();
      return { restarted: true };
    }

    const vote = this.voteRematch(playerId, true);
    if ('started' in vote) return { restarted: false, ready: true };
    return { restarted: false, ready: vote.ready };
  }

  startGame(requesterId: string) {
    const requester = this._requirePlayer(requesterId);
    assert(requester.isHost, ErrorCodes.HOST_ONLY, 'Only the host can start the game');

    if (this.phase === PHASES.GAME_OVER) this._resetForRematch();
    this._launchMatch();
  }

  addBot(requesterId: string, count = 1) {
    const requester = this._requirePlayer(requesterId);
    assert(requester.isHost, ErrorCodes.HOST_ONLY, 'لصاحب الأوضة بس إضافة بوتات');
    assert(
      this.phase === PHASES.LOBBY,
      ErrorCodes.GAME_IN_PROGRESS,
      'البوتات بتتجاب قبل ما اللعبة تبدأ بس',
    );

    const requested = Math.max(1, Math.min(LIMITS.MAX_PLAYERS, Number(count) || 1));
    for (let i = 0; i < requested; i += 1) {
      assert(
        this.players.size < LIMITS.MAX_PLAYERS,
        ErrorCodes.ROOM_FULL,
        `الأوضة اتملت (${LIMITS.MAX_PLAYERS} لاعب)`,
      );
      const bot = this._createPlayer(this._nextBotName(), null);
      bot.isBot = true;
      this.players.set(bot.id, bot);
      logger.info(`Room ${this.code}: bot joined as ${bot.name}`);
    }

    this.touch();
    this.broadcastUpdate();
  }

  _nextBotName(): string {
    const pool = ['حسن', 'نجوان', 'مصطفى', 'سارة', 'عم صابر', 'سوسن', 'فرح', 'حلا', 'شريف', 'دُدو'];
    const taken = new Set([...this.players.values()].map((player) => player.name.toLowerCase()));
    for (const candidate of pool) {
      const full = `بوت ${candidate}`;
      if (!taken.has(full.toLowerCase())) return full;
    }
    let suffix = this.players.size + 1;
    while (taken.has(`بوت ${suffix}`)) suffix += 1;
    return `بوت ${suffix}`;
  }

  voteRematch(playerId: string, ready = true): { ready: boolean } | { started: boolean } {
    assert(
      this.phase === PHASES.GAME_OVER,
      ErrorCodes.PHASE_INVALID,
      'Rematch votes are only accepted after the game ends',
    );
    const player = this._requirePlayer(playerId);

    if (!ready) {
      this.rematchVotes.delete(player.id);
      this.touch();
      this.broadcastUpdate();
      return { ready: false };
    }

    this.rematchVotes.add(player.id);
    this.touch();

    const connected = [...this.players.values()].filter((p) => p.isConnected);
    const unanimous =
      connected.length >= LIMITS.MIN_PLAYERS &&
      connected.every((p) => this.rematchVotes.has(p.id));
    if (unanimous) {
      logger.info(`Room ${this.code}: unanimous rematch vote, restarting`);
      this._beginRematch();
      return { started: true };
    }

    this.broadcastUpdate();
    return { ready: true };
  }

  submitNightAction(playerId: string, targetId: string | null) {
    assert(
      targetId === null || typeof targetId === 'string',
      ErrorCodes.VALIDATION_ERROR,
      'targetId must be a player id or null to skip',
    );
    assert(this.phase === PHASES.NIGHT, ErrorCodes.PHASE_INVALID, 'Night actions are only accepted at night');
    assert(!this.awaitingRevenge, ErrorCodes.PHASE_INVALID, 'The town is waiting on a dying Good Boy');

    const player = this._requirePlayer(playerId);
    assert(player.isAlive, ErrorCodes.PLAYER_DEAD, 'Dead players cannot use abilities');

    const ability = NIGHT_ABILITIES[player.role as keyof typeof NIGHT_ABILITIES];
    assert(ability, ErrorCodes.ROLE_MISMATCH, `${player.role ?? 'Your role'} has no night ability`);

    if (!this.expectedNightActors.has(player.id)) {
      if (player.role === ROLES.SNIPER) {
        throw new GameError(ErrorCodes.NO_BULLETS_LEFT, 'Your only bullet has already been spent');
      }
      throw new GameError(ErrorCodes.ACTION_NOT_ALLOWED, 'You are not expected to act tonight');
    }
    assert(!this.nightActions.has(player.id), ErrorCodes.ALREADY_SUBMITTED, 'Tonight’s action has already been sealed');

    if (targetId !== null) {
      const target = this._requirePlayer(targetId);
      assert(this._isValidTargetFor(player, target), ErrorCodes.TARGET_INVALID, 'That target is not valid for your ability');
    }

    this.nightActions.set(player.id, { ability, targetId });
    this.touch();
    this._emitToPlayer(player, 'action:accepted', { kind: 'NIGHT_ABILITY', ability, targetId });

    if ([...this.expectedNightActors].every((id) => this.nightActions.has(id))) {
      this._resolveNight();
    }
  }

  submitRevenge(playerId: string, targetId: string | null) {
    const revenge = this.awaitingRevenge;
    assert(revenge, ErrorCodes.ACTION_NOT_ALLOWED, 'There is no revenge decision pending');
    assert(revenge.playerId === playerId, ErrorCodes.ACTION_NOT_ALLOWED, 'Only the fallen Good Boy may answer this prompt');
    assert(targetId === null || typeof targetId === 'string', ErrorCodes.VALIDATION_ERROR, 'targetId must be a player id or null to spare them');

    const { onDone, extraDeaths } = revenge;

    if (targetId !== null) {
      const target = this._requirePlayer(targetId);
      assert(target.isAlive, ErrorCodes.TARGET_INVALID, 'That player is already dead');
      assert(!revenge.excluded.has(targetId), ErrorCodes.TARGET_INVALID, 'That player is already dying tonight');
      extraDeaths.push({ id: targetId, cause: DEATH_CAUSES.GOOD_BOY_REVENGE });
    }

    this.awaitingRevenge = null;
    this._clearTimer();
    this._emitToPlayer(this.players.get(playerId)!, 'action:accepted', { kind: 'GOOD_BOY_REVENGE', targetId });
    this.touch();
    onDone(extraDeaths);
  }

  revealMayor(playerId: string) {
    const player = this._requirePlayer(playerId);
    assert(MAYOR_PHASES.has(this.phase), ErrorCodes.PHASE_INVALID, 'The Mayor can only reveal during the day');
    assert(player.isAlive, ErrorCodes.PLAYER_DEAD, 'Fallen mayors cannot address the town');
    assert(player.role === ROLES.MAYOR, ErrorCodes.ROLE_MISMATCH, 'Only the Mayor can do that');
    assert(!player.hasRevealed, ErrorCodes.MAYOR_ALREADY_REVEALED, 'You have already revealed yourself');

    player.hasRevealed = true;
    this.touch();
    this._logEvent(`العمدة ${player.name} كشف نفسه — صوته بقى ×3`, 'MAYOR');
    this.bus.to(this.code).emit('game:mayor_revealed', { playerId: player.id, name: player.name });
    this.broadcastUpdate();
    logger.info(`Room ${this.code}: Mayor ${player.name} revealed (vote weight x3)`);
  }

  castVote(voterId: string, targetId: string) {
    assert(typeof targetId === 'string', ErrorCodes.VALIDATION_ERROR, 'A vote requires a targetId');
    assert(
      this.phase === PHASES.DAY_VOTING || this.phase === PHASES.DEFENSE_STAGE,
      ErrorCodes.PHASE_INVALID,
      'Voting is not open right now',
    );
    assert(!this.awaitingRevenge, ErrorCodes.PHASE_INVALID, 'The vote is paused by a dying curse');

    const voter = this._requirePlayer(voterId);
    assert(voter.isAlive, ErrorCodes.PLAYER_DEAD, 'Dead players cannot vote');
    const voteShift = this.phase === PHASES.DEFENSE_STAGE && this.votes.has(voterId);
    if (!voteShift) {
      assert(!this.votes.has(voterId), ErrorCodes.ALREADY_VOTED, 'Your vote is already locked in');
    }

    const target = this._requirePlayer(targetId);
    assert(target.isAlive, ErrorCodes.TARGET_INVALID, 'You cannot vote for a dead player');
    assert(target.id !== voter.id, ErrorCodes.SELF_TARGET_FORBIDDEN, 'Voting for yourself is forbidden');

    this.votes.set(voterId, targetId);
    this.voteTally.set(targetId, (this.voteTally.get(targetId) ?? 0) + 1);
    this.touch();
    this.broadcastUpdate();
    this._emitToPlayer(voter, 'action:accepted', { kind: 'VOTE', targetId, weight: voteWeightOf(voter) });

    const expected = this._alivePlayers().length;
    this.bus.to(this.code).emit('vote:progress', { cast: this.votes.size, expected });
    if (this.votes.size >= expected) this._resolveVotes();
  }

  sendReaction(senderId: string, emojiId: string) {
    const sender = this._requirePlayer(senderId);
    assert(
      typeof emojiId === 'string' && REACTION_IDS.includes(emojiId),
      ErrorCodes.VALIDATION_ERROR,
      'Unknown reaction',
    );
    this.bus.to(this.code).emit('reaction:show', { playerId: sender.id, emojiId });
  }

  postChat(senderId: string, rawText: string) {
    const text = sanitizeChatText(rawText, config.chat.maxLength);
    const sender = this._requirePlayer(senderId);
    const nightFamilyChannel = this.phase === PHASES.NIGHT && sender.isAlive && sender.team === TEAMS.MAFIA;
    assert(CHAT_PHASES.has(this.phase) || nightFamilyChannel, ErrorCodes.PHASE_INVALID, 'Chat is closed right now');
    if (this.phase !== PHASES.GAME_OVER && this.phase !== PHASES.LOBBY && !nightFamilyChannel) {
      assert(sender.isAlive, ErrorCodes.PLAYER_DEAD, 'Ghosts cannot speak to the living');
    }
    assert(!sender.isSilenced || this.phase === PHASES.GAME_OVER, ErrorCodes.CHAT_BLOCKED, 'You have been silenced for the day');

    const message = { from: { id: sender.id, name: sender.name }, text, at: Date.now() };

    if (nightFamilyChannel) {
      const familySockets = [...this.players.values()]
        .filter((p) => p.isAlive && p.team === TEAMS.MAFIA && p.socketId && p.id !== sender.id)
        .map((p) => p.socketId)
        .filter((socketId): socketId is string => Boolean(socketId));
      if (familySockets.length > 0) this.bus.to(familySockets).emit('chat:message', message);
    } else {
      this.bus.to(this.code).emit('chat:message', message);
    }

    if (!sender.isBot && !nightFamilyChannel) this._handleBotReaction(text);
    return { sent: true };
  }

  syncFor(playerId: string) {
    return this.privateState(playerId);
  }

  isEmpty(): boolean {
    return ![...this.players.values()].some((player) => player.isConnected);
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  _logEvent(text: string, kind = 'INFO') {
    this.eventLog.push({ kind, text, round: this.round, at: Date.now() });
    if (this.eventLog.length > 60) this.eventLog.splice(0, this.eventLog.length - 60);
  }

  dispose() {
    this._clearBotTimers();
    this._clearTimer();
  }

  publicState() {
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      deadline: this.phaseEndsAt,
      awaitingRevenge: this.awaitingRevenge ? { source: this.awaitingRevenge.source } : null,
      lastWords: this.phase === PHASES.LAST_WORDS && this.lastWordsPlayerId ? { playerId: this.lastWordsPlayerId } : null,
      defense: this.phase === PHASES.DEFENSE_STAGE && this.defensePlayerId ? { playerId: this.defensePlayerId } : null,
      eventLog: this.eventLog.slice(-40),
      nightReport: this.pendingNightReport ?? { victim: null, silenced: null },
      votesCast: this.votes.size,
      votesExpected: this._alivePlayers().length,
      voteLog:
        DAY_PHASES.has(this.phase)
          ? [...this.votes.entries()].map(([voterId, targetId]) => ({ voterId, targetId }))
          : [],
      voteTally: Object.fromEntries(this.voteTally),
      rematchVotes: [...this.rematchVotes],
      result: this.result,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        isBot: Boolean(player.isBot),
        isConnected: player.isConnected,
        isAlive: player.isAlive,
        isSilenced: player.isSilenced,
        micEnabled: this._micEnabled(player),
        hasRevealed: player.hasRevealed,
        voteWeight: voteWeightOf(player),
        sid: player.socketId ?? null,
      })),
    };
  }

  privateState(playerId: string) {
    const player = this._requirePlayer(playerId);
    const base = this.publicState();
    return {
      ...base,
      you: {
        id: player.id,
        token: player.token,
        name: player.name,
        isHost: player.isHost,
        role: player.role,
        team: player.team,
        isAlive: player.isAlive,
        isSilenced: player.isSilenced,
        hasRevealed: player.hasRevealed,
        bulletsLeft: player.bulletsLeft,
        ability: NIGHT_ABILITIES[player.role as keyof typeof NIGHT_ABILITIES] ?? null,
        partners: this._partnersOf(player),
        hasSubmittedNightAction: this.nightActions.has(player.id),
        voteTarget: this.votes.get(player.id) ?? null,
      },
    };
  }

  broadcastUpdate() {
    this.bus.to(this.code).emit('room:update', this.publicState());
    this._broadcastVoicePolicies();
  }

  _broadcastVoicePolicies() {
    for (const player of this.players.values()) {
      if (!player.isConnected) continue;
      this._emitToPlayer(player, 'voice:policy', this._buildVoicePolicy(player));
    }
  }

  _buildVoicePolicy(player: Player) {
    const connected = [...this.players.values()].filter((candidate) => candidate.isConnected && candidate.socketId);
    const dayPhase = DAY_PHASES.has(this.phase);
    const socialPhase = this.phase === PHASES.LOBBY || this.phase === PHASES.GAME_OVER;
    const nightPhase = this.phase === PHASES.NIGHT;
    const lastWordsPhase = this.phase === PHASES.LAST_WORDS;
    const defensePhase = this.phase === PHASES.DEFENSE_STAGE;

    let channel = 'MUTED';
    if (socialPhase) channel = 'LOBBY';
    else if (nightPhase && player.isAlive && player.team === TEAMS.MAFIA) channel = 'MAFIA';
    else if ((lastWordsPhase || defensePhase) && player.isAlive) channel = 'TOWN';
    else if (!player.isAlive) channel = 'DEAD';
    else if (dayPhase) channel = 'TOWN';

    let canSpeak = false;
    let canHear = false;
    let audible: string[] = [];

    const socketsOf = (filter: (peer: Player) => boolean) =>
      connected
        .filter(filter)
        .map((peer) => peer.socketId)
        .filter((socketId): socketId is string => Boolean(socketId));

    if (channel === 'LOBBY') {
      canSpeak = true;
      canHear = true;
      audible = socketsOf((peer) => peer.id !== player.id);
    } else if (channel === 'MAFIA') {
      canSpeak = true;
      canHear = true;
      audible = socketsOf((peer) => peer.team === TEAMS.MAFIA && peer.id !== player.id);
    } else if (channel === 'TOWN' && (lastWordsPhase || defensePhase)) {
      const speakerId = lastWordsPhase ? this.lastWordsPlayerId : this.defensePlayerId;
      canHear = true;
      if (player.id === speakerId) {
        canSpeak = true;
        audible = socketsOf((peer) => peer.id !== player.id);
      } else {
        canSpeak = false;
        const accused = connected.find((peer) => peer.id === speakerId);
        audible = accused?.socketId ? [accused.socketId] : [];
      }
    } else if (channel === 'TOWN') {
      canHear = true;
      canSpeak = !player.isSilenced;
      audible = socketsOf((peer) => peer.isAlive && !peer.isSilenced && peer.id !== player.id);
    } else if (channel === 'DEAD') {
      canSpeak = false;
      canHear = dayPhase;
      if (dayPhase) audible = socketsOf((peer) => peer.isAlive && !peer.isSilenced);
    }

    return { channel, canSpeak, canHear, audible, phase: this.phase, round: this.round };
  }

  _createPlayer(name: string, socketId: string | null) {
    return {
      id: randomToken(),
      token: randomToken(),
      socketId,
      name,
      isHost: false,
      isBot: false,
      isConnected: true,
      role: null,
      team: null,
      isAlive: true,
      isSilenced: false,
      hasRevealed: false,
      bulletsLeft: 0,
      deathCause: null,
      deathRound: 0,
    };
  }

  _assignRole(player: Player, role: string) {
    player.role = role;
    player.team = ROLE_TEAMS[role as keyof typeof ROLE_TEAMS];
    player.bulletsLeft = role === ROLES.SNIPER || role === ROLES.VIGILANTE ? 1 : 0;
  }

  assignRoles(players: Player[]) {
    const deck = buildDeck(players.length);
    players.forEach((player, index) => this._assignRole(player, deck[index]));

    const mafiaTeammates = players
      .filter((p) => p.team === TEAMS.MAFIA)
      .map((p) => ({ id: p.id, name: p.name }));

    for (const player of players) {
      this._emitToPlayer(player, 'game:role_assigned', {
        roleName: player.role,
        team: player.team,
        abilities: NIGHT_ABILITIES[player.role as keyof typeof NIGHT_ABILITIES] ?? null,
      });
      if (player.team === TEAMS.MAFIA && mafiaTeammates.length > 0) {
        this._emitToPlayer(player, 'game:mafia_team_revealed', { teammates: mafiaTeammates });
      }
    }
  }

  _launchMatch() {
    assert(this.phase === PHASES.LOBBY, ErrorCodes.GAME_IN_PROGRESS, 'The game is already running');
    assert(
      this.players.size >= LIMITS.MIN_PLAYERS,
      ErrorCodes.NOT_ENOUGH_PLAYERS,
      `At least ${LIMITS.MIN_PLAYERS} players are needed to start`,
    );
    assert(
      this.players.size <= LIMITS.MAX_PLAYERS,
      ErrorCodes.TOO_MANY_PLAYERS,
      `A game supports at most ${LIMITS.MAX_PLAYERS} players`,
    );

    const seats = [...this.players.values()];
    this.assignRoles(seats);

    logger.info(`Room ${this.code}: game started with ${seats.length} players`);
    for (const player of seats) {
      this._emitToPlayer(player, 'game:started', this.privateState(player.id));
    }
    this._advanceToNight();
  }

  _beginRematch() {
    this._resetForRematch(true);
    this._launchMatch();
  }

  _resetForRematch(silent = false) {
    for (const player of this.players.values()) {
      player.role = null;
      player.team = null;
      player.isAlive = true;
      player.isSilenced = false;
      player.hasRevealed = false;
      player.bulletsLeft = 0;
      player.deathCause = null;
      player.deathRound = 0;
    }
    this.round = 0;
    this.result = null;
    this.eventLog = [];
    this.lastWordsPlayerId = null;
    this.defensePlayerId = null;
    this.lastNightDeaths = [];
    this.pendingNightReport = null;
    this.nightActions.clear();
    this.votes.clear();
    this.voteTally.clear();
    this.rematchVotes.clear();
    this.awaitingRevenge = null;
    this._clearBotTimers();
    this._clearTimer();
    this.phase = PHASES.LOBBY;
    if (!silent) this.broadcastUpdate();
  }

  _bots(): Player[] {
    return [...this.players.values()].filter((player) => player.isBot);
  }

  _scheduleBot(fn: () => void, minMs: number, maxMs: number) {
    const delay = minMs + Math.floor(Math.random() * Math.max(1, maxMs - minMs));
    const timer = setTimeout(() => {
      this.botTimers.delete(timer);
      try {
        fn();
      } catch {
        /* stale bot tick */
      }
    }, delay);
    this.botTimers.add(timer);
  }

  _clearBotTimers() {
    for (const timer of this.botTimers) clearTimeout(timer);
    this.botTimers.clear();
  }

  _scheduleNightBots() {
    for (const bot of this._bots()) {
      if (!this.expectedNightActors.has(bot.id)) continue;
      this._scheduleBot(
        () => {
          if (this.phase !== PHASES.NIGHT || this.awaitingRevenge) return;
          const current = this.players.get(bot.id);
          if (!current || !current.isAlive || this.nightActions.has(current.id)) return;
          const options = this._alivePlayers().filter((target) => this._isValidTargetFor(current, target));
          const holdFire = current.role === ROLES.SNIPER && Math.random() < 0.35;
          const targetId = options.length && !holdFire ? options[Math.floor(Math.random() * options.length)].id : null;
          this.submitNightAction(current.id, targetId);
        },
        1500,
        3000,
      );
    }
  }

  _scheduleVoteBots() {
    for (const bot of this._bots()) {
      if (!bot.isAlive) continue;
      this._scheduleBot(
        () => {
          if (this.phase !== PHASES.DAY_VOTING || this.awaitingRevenge) return;
          const current = this.players.get(bot.id);
          if (!current || !current.isAlive || this.votes.has(current.id)) return;
          const candidates = this._alivePlayers().filter((p) => p.id !== current.id);
          if (!candidates.length) return;
          this.castVote(current.id, candidates[Math.floor(Math.random() * candidates.length)].id);
        },
        1500,
        3500,
      );
    }
  }

  _handleBotReaction(text: string) {
    if (!BOT_REACTION_PHASES.has(this.phase)) return;
    if (this.lastBotReactionAt && Date.now() - this.lastBotReactionAt < BOT_REACTION_COOLDOWN_MS) {
      return;
    }

    const aliveBots = this._bots().filter((bot) => bot.isAlive && !bot.isSilenced);
    if (!aliveBots.length) return;

    const msg = text.toLowerCase();
    let intent = 'default';
    if (/(مافيا|كداب|تكدب|قاتل|قتلت|خاين|انت|انتي|ظالم)/.test(msg)) intent = 'accusation';
    else if (/(مين|شاكين|تفتكروا|رأيكم|نعمل|ازاي|ليه)/.test(msg)) intent = 'question';
    else if (/(صوت|نصوت|فوت|نطلع|اعدام|نقتل)/.test(msg)) intent = 'voting';
    else if (/(سلام|هاي|شباب|يلا|جاهزين|مساء)/.test(msg)) intent = 'greeting';

    let speaker: Player | null = null;
    for (const [dictKey, aliases] of Object.entries(BOT_MENTION_ALIASES)) {
      if (aliases.some((alias) => msg.includes(alias))) {
        const named = aliveBots.find((bot) => bot.name === dictKey);
        if (named) {
          speaker = named;
          break;
        }
      }
    }
    if (!speaker) speaker = aliveBots[Math.floor(Math.random() * aliveBots.length)];

    const botData = BOT_DICTIONARY[speaker.name] || BOT_DICTIONARY['بوت حسن'];
    const responses = botData[intent] || botData.default;
    const reply = responses[Math.floor(Math.random() * responses.length)];
    this.lastBotReactionAt = Date.now();
    logger.info(`Room ${this.code}: bot ${speaker.name} reacting (intent=${intent}) to "${text.slice(0, 40)}"`);

    this._scheduleBot(() => {
      if (!BOT_REACTION_PHASES.has(this.phase)) return;
      const current = this.players.get(speaker!.id);
      if (!current || !current.isAlive || current.isSilenced) return;
      this.bus.to(this.code).emit('chat:message', {
        from: { id: current.id, name: current.name },
        text: reply,
        at: Date.now(),
      });
    }, 2000, 4500);
  }

  _scheduleBotChat() {
    const aliveBots = this._bots().filter((bot) => bot.isAlive);
    if (!aliveBots.length) return;

    const lines = this._botChatLines();
    const speakers = [...aliveBots].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.6 ? 1 : 2);

    speakers.forEach((bot, index) => {
      this._scheduleBot(
        () => {
          if (this.phase !== PHASES.DAY_DISCUSSION) return;
          const current = this.players.get(bot.id);
          if (!current || !current.isAlive || current.isSilenced) return;
          const line = lines[Math.floor(Math.random() * lines.length)];
          if (!line) return;
          this.bus.to(this.code).emit('chat:message', {
            from: { id: current.id, name: current.name },
            text: line,
            at: Date.now(),
          });
        },
        1400 + index * 2800,
        3000 + index * 3000,
      );
    });
  }

  _botChatLines(): string[] {
    const lines: string[] = [];
    const fallen = (this.lastNightDeaths ?? []).filter(Boolean);
    const mayor = [...this.players.values()].find((player) => player.hasRevealed && player.isAlive);

    if (fallen.length > 1) {
      lines.push(
        `اتنين راحوا في ليلة واحدة؟! ${fallen.map((d) => d.name).join(' و ')}.. المافيا جعانة الليلة`,
        `شهداء كتير: ${fallen.map((d) => d.name).join('، ')} — لازم نستهدف صح النهارده`,
      );
    } else if (fallen.length === 1) {
      lines.push(
        `يا حرام ${fallen[0].name}.. كان لسه عايشن معانا`,
        `الليل شال ${fallen[0].name}.. خدوا بالكوا من نفسكوا`,
        `سلام ${fallen[0].name}.. اللي عمل كده هيتكشف قريب`,
      );
    } else {
      lines.push(
        'الليلة عدت من غير ضحايا.. المافيا بتريق علينا',
        'مفيش موتى الليلة دي؟ يبقى الحماية شغالة.. أو حد بيستعرض',
      );
    }

    if (mayor) {
      lines.push(`العمدة ${mayor.name} اتكشف — صوته بقى ×3، اسمعوا كلامه`);
    }

    lines.push(
      'في حد بينا بيكذب علينا كل يوم.. مين؟',
      'يلا نركز: مين كان ساكت طول الليل؟',
      'أنا مشبوهيني من حد قاعد قدامي.. بس هسيبكم تحكموا',
    );

    return lines;
  }

  _advanceToNight(elimination: { playerId: string; name: string; role: string | null } | null = null) {
    this.round += 1;
    this.phase = PHASES.NIGHT;
    this.votes.clear();
    this.nightActions.clear();
    this.awaitingRevenge = null;
    this.pendingNightReport = null;
    for (const player of this.players.values()) player.isSilenced = false;

    this.expectedNightActors = new Set(
      [...this.players.values()].filter((player) => this._canActAtNight(player)).map((p) => p.id),
    );

    this._armTimer(config.timers.NIGHT_MS, () => this._resolveNight());
    this.broadcastPhase({ elimination });
    this.broadcastUpdate();
    for (const id of this.expectedNightActors) {
      const actor = this.players.get(id);
      if (actor) this._sendNightPrompt(actor);
    }
    this._scheduleNightBots();
  }

  _canActAtNight(player: Player) {
    if (!player.isAlive) return false;
    if (!NIGHT_ABILITIES[player.role as keyof typeof NIGHT_ABILITIES]) return false;
    if ((player.role === ROLES.SNIPER || player.role === ROLES.VIGILANTE) && player.bulletsLeft <= 0) {
      return false;
    }
    return true;
  }

  _sendNightPrompt(player: Player) {
    const options = this._alivePlayers()
      .filter((target) => this._isValidTargetFor(player, target))
      .map((target) => ({ id: target.id, name: target.name }));

    this._emitToPlayer(player, 'action:request', {
      kind: 'NIGHT_ABILITY',
      ability: NIGHT_ABILITIES[player.role as keyof typeof NIGHT_ABILITIES],
      allowsSkip: true,
      options,
      deadline: this.phaseEndsAt,
    });
  }

  _isValidTargetFor(actor: Player, target: Player) {
    if (!target.isAlive) return false;
    if (actor.role === ROLES.MEDIC) return true;
    if (target.id === actor.id) return false;
    if (ROLE_TEAMS[actor.role as keyof typeof ROLE_TEAMS] === TEAMS.MAFIA && ROLE_TEAMS[target.role as keyof typeof ROLE_TEAMS] === TEAMS.MAFIA) {
      return false;
    }
    return true;
  }

  _resolveNight() {
    if (this.phase !== PHASES.NIGHT) return;
    this._clearTimer();

    const outcome = resolveNightActions(this.players, this.nightActions);

    if (outcome.silenceTargetId) {
      const silenced = this.players.get(outcome.silenceTargetId);
      if (silenced) silenced.isSilenced = true;
    }
    if (outcome.shotFired && outcome.shooterId) {
      const shooter = this.players.get(outcome.shooterId);
      if (shooter) shooter.bulletsLeft = Math.max(0, shooter.bulletsLeft - 1);
    }
    if (outcome.vigilanteFired && outcome.vigilanteShooterId) {
      const shooter = this.players.get(outcome.vigilanteShooterId);
      if (shooter) shooter.bulletsLeft = Math.max(0, shooter.bulletsLeft - 1);
    }

    if (outcome.investigation) {
      const detective = this.players.get(outcome.investigation.detectiveId);
      const { targetName, verdict } = outcome.investigation;
      if (detective?.socketId && detective.isAlive) {
        this.bus.to(detective.socketId).emit('chat:message', {
          from: { id: '__detective__', name: 'المحقق فيك' },
          text:
            verdict === 'MAFIA'
              ? `${targetName} طلع عليه آثار مافيا.. متطمنش كتير، بس خد بالك.`
              : `${targetName} فحصته مشوار.. مفيش عليه شيئًا يديناه.`,
          at: Date.now(),
        });
      }
    }

    const fallenGoodBoy = outcome.deaths
      .map((id: string) => this.players.get(id))
      .find((player) => player?.role === ROLES.GOOD_BOY);

    if (fallenGoodBoy) {
      this._beginRevenge({
        deadPlayer: fallenGoodBoy,
        source: 'NIGHT',
        excluded: outcome.deaths,
        onDone: (extraDeaths: ExtraDeath[]) => {
          for (const { id, cause } of extraDeaths) outcome.addDeath(id, cause);
          this._finishNight(outcome);
        },
      });
      return;
    }

    this._finishNight(outcome);
  }

  _finishNight(outcome: NightOutcome) {
    this.nightActions.clear();
    const deaths = outcome.deaths
      .map((id) => this._applyDeath(id, outcome.deathCauses.get(id) ?? ['UNKNOWN']))
      .filter((report): report is DeathReport => Boolean(report));
    this.lastNightDeaths = deaths;

    this.bus.to(this.code).emit('game:night_result', {
      round: this.round,
      events: outcome.events,
      deaths,
    });
    if (deaths.length > 0) {
      const names = deaths.map((d) => d.name).join(' و');
      this._logEvent(`بعد ليلة ${this.round}: سقط ${names}`, 'NIGHT');
    } else {
      this._logEvent(`ليلة ${this.round} عدّت من غير ضحايا`, 'NIGHT');
    }

    const silenced = [...this.players.values()].find((p) => p.isSilenced && p.isAlive);
    this.pendingNightReport = {
      victim: deaths[0]?.name ?? null,
      silenced: silenced?.name ?? null,
    };

    this.broadcastUpdate();

    if (this._checkWin()) return;
    this._openDiscussion();
  }

  _openDiscussion() {
    this.phase = PHASES.DAY_DISCUSSION;
    this._armTimer(config.timers.DAY_DISCUSSION_MS, () => this._openVoting());
    const nightReport = this.pendingNightReport ?? { victim: null, silenced: null };
    this.broadcastPhase({ nightReport });
    this.broadcastUpdate();
    this._scheduleBotChat();
  }

  _openVoting() {
    this.phase = PHASES.DAY_VOTING;
    this.votes.clear();
    this._armTimer(config.timers.DAY_VOTING_MS, () => this._resolveVotes());
    this.broadcastPhase();
    this.broadcastUpdate();
    this._scheduleVoteBots();
  }

  _resolveVotes() {
    if (this.phase !== PHASES.DAY_VOTING) return;
    this._clearTimer();

    const voters = this._alivePlayers();
    const tally = tallyVotes(this.players, this.votes);
    const { eliminatedId, tied, topCount } = resolveTally(tally);

    const tallyRows = [...tally.entries()]
      .map(([pid, weightedVotes]) => ({
        playerId: pid,
        name: this.players.get(pid)?.name ?? 'Unknown',
        weightedVotes,
      }))
      .sort((a, b) => b.weightedVotes - a.weightedVotes);

    const weights = voters.map((player) => ({
      playerId: player.id,
      name: player.name,
      weight: voteWeightOf(player),
    }));

    const eliminatedPlayer = eliminatedId ? this.players.get(eliminatedId) : null;

    this.bus.to(this.code).emit('game:vote_result', {
      round: this.round,
      tally: tallyRows,
      weights,
      tied,
      topCount,
      eliminated: eliminatedPlayer
        ? { id: eliminatedPlayer.id, name: eliminatedPlayer.name, role: eliminatedPlayer.role }
        : null,
    });

    if (!eliminatedPlayer) {
      this._logEvent(`محاكمة ${this.round}: الأصوات تعادلت.. محدش بيتشنق النهارده`, 'VOTE');
      this.broadcastUpdate();
      this._advanceToNight();
      return;
    }

    this._beginDefense(eliminatedPlayer);
  }

  _beginDefense(accused: Player) {
    this.phase = PHASES.DEFENSE_STAGE;
    this.defensePlayerId = accused.id;
    this._logEvent(
      `${accused.name} فوق منصة الاتهام! عنده ${Math.round(config.timers.DEFENSE_MS / 1000)} ثانية يدافع.. والتصويت لسه بيتحرك!`,
      'DEFENSE',
    );
    this._armTimer(config.timers.DEFENSE_MS, () => this._finishDefense());
    this.broadcastPhase();
    this.broadcastUpdate();
    logger.info(`Room ${this.code}: ${accused.name} defends (${config.timers.DEFENSE_MS}ms, vote shifting open)`);
  }

  _finishDefense() {
    if (this.phase !== PHASES.DEFENSE_STAGE) return;
    this._clearTimer();
    this.defensePlayerId = null;

    const tally = tallyVotes(this.players, this.votes);
    const { eliminatedId } = resolveTally(tally);
    const condemned = eliminatedId ? this.players.get(eliminatedId) ?? null : null;

    if (!condemned || !condemned.isAlive) {
      this._logEvent('التصويت اتلخبط في الدقيقة الأخيرة.. محدش اتحكم عليه النهاردة!', 'DEFENSE');
      this.broadcastUpdate();
      this._advanceToNight();
      return;
    }

    this._beginLastWords(condemned);
  }

  _beginLastWords(accused: Player) {
    this.phase = PHASES.LAST_WORDS;
    this.lastWordsPlayerId = accused.id;
    this._logEvent(`${accused.name} طلع المنصة.. ليه ٢٠ ثانية آخر كلام`, 'LAST_WORDS');
    this._armTimer(config.timers.LAST_WORDS_MS, () => this._finishLastWords());
    this.broadcastPhase();
    this.broadcastUpdate();
    logger.info(`Room ${this.code}: ${accused.name} gets last words (${config.timers.LAST_WORDS_MS}ms)`);
  }

  _finishLastWords() {
    if (this.phase !== PHASES.LAST_WORDS) return;
    this._clearTimer();

    const accused = this.lastWordsPlayerId ? this.players.get(this.lastWordsPlayerId) ?? null : null;
    this.lastWordsPlayerId = null;

    let eliminatedInfo: DeathReport | null = null;
    if (accused && accused.isAlive) {
      eliminatedInfo = this._applyDeath(accused.id, [DEATH_CAUSES.VOTE_ELIMINATION]);
      this._logEvent(`قرار المجلس نزل على ${accused.name}`, 'EXECUTION');
    }

    if (accused && accused.role === ROLES.JOKER && eliminatedInfo) {
      this.broadcastUpdate();
      this._endGame(TEAMS.NEUTRAL, `الجوكر ${accused.name} اتحكم عليه.. وكسب الرهان لوحده!`);
      return;
    }

    const eliminationPayload =
      eliminatedInfo && accused ? { playerId: accused.id, name: accused.name, role: accused.role } : null;

    this.broadcastUpdate();

    const proceed = (extraDeaths: ExtraDeath[] = []) => {
      for (const { id, cause } of extraDeaths) {
        this._applyDeath(id, [cause]);
      }
      this.broadcastUpdate();
      if (this._checkWin()) return;
      this._advanceToNight(eliminationPayload);
    };

    if (eliminatedInfo && accused?.role === ROLES.GOOD_BOY) {
      this._beginRevenge({
        deadPlayer: accused,
        source: 'VOTE',
        excluded: [accused.id],
        onDone: proceed,
      });
      return;
    }

    proceed();
  }

  _beginRevenge({ deadPlayer, source, excluded, onDone }: RevengeRequest) {
    this.awaitingRevenge = {
      playerId: deadPlayer.id,
      source,
      excluded: new Set(excluded),
      extraDeaths: [],
      onDone,
    };
    this.touch();
    this._armTimer(config.timers.REVENGE_MS, () => this.submitRevenge(deadPlayer.id, null));
    this.broadcastPhase();
    this.broadcastUpdate();
    this._sendRevengePrompt(deadPlayer);
    if (deadPlayer.isBot) {
      this._scheduleBot(() => {
        const revenge = this.awaitingRevenge;
        if (!revenge || revenge.playerId !== deadPlayer.id) return;
        const options = this._alivePlayers().filter((candidate) => !revenge.excluded.has(candidate.id));
        const targetId = options.length && Math.random() < 0.7 ? options[Math.floor(Math.random() * options.length)].id : null;
        this.submitRevenge(deadPlayer.id, targetId);
      }, 2000, 4000);
    }
    logger.info(`Room ${this.code}: Good Boy ${deadPlayer.name} fell (${source}) — revenge pending`);
  }

  _sendRevengePrompt(player: Player) {
    const revenge = this.awaitingRevenge;
    if (!revenge) return;
    const options = this._alivePlayers()
      .filter((candidate: Player) => !revenge.excluded.has(candidate.id))
      .map((candidate: Player) => ({ id: candidate.id, name: candidate.name }));

    this._emitToPlayer(player, 'good_boy:prompt', {
      source: revenge.source,
      options,
      deadline: this.phaseEndsAt,
    });
  }

  _applyDeath(playerId: string, causes: string[]): DeathReport | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    player.isAlive = false;
    player.deathRound = this.round;
    player.deathCause = causes.join(' & ');
    return { id: player.id, name: player.name, role: player.role, causes };
  }

  _checkWin() {
    const alive = this._alivePlayers();
    const mafiaCount = alive.filter((p) => p.team === TEAMS.MAFIA).length;
    const townCount = alive.length - mafiaCount;

    if (mafiaCount === 0) {
      this._endGame(TEAMS.TOWN, 'آخر مافيا في البلد اتشال. الأهالي كسبوا.');
      return true;
    }
    if (mafiaCount >= townCount) {
      this._endGame(TEAMS.MAFIA, 'المافيا بقت بتعادل الأهالي.. الشوارع بقت ملكها.');
      return true;
    }
    return false;
  }

  _endGame(winner: string, reason: string) {
    this.phase = PHASES.GAME_OVER;
    this.awaitingRevenge = null;
    this._clearTimer();
    this.result = {
      winner,
      reason,
      roster: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        isAlive: player.isAlive,
        isHost: player.isHost,
      })),
    };
    this.bus.to(this.code).emit('game:over', this.result);
    this._logEvent(`${winner === TEAMS.MAFIA ? 'المافيا' : 'الأهالي'} كسبوا — ${reason}`, 'WIN');
    this.broadcastUpdate();
    logger.info(`Room ${this.code}: game over — ${winner} wins`);
  }

  broadcastPhase(extra: Record<string, unknown> | null = null) {
    this.bus.to(this.code).emit('phase:change', {
      phase: this.phase,
      round: this.round,
      deadline: this.phaseEndsAt,
      awaitingRevenge: this.awaitingRevenge ? { source: this.awaitingRevenge.source } : null,
      ...(extra ?? {}),
    });
  }

  _micEnabled(player: Player) {
    if (this.phase === PHASES.LOBBY || this.phase === PHASES.GAME_OVER) {
      return player.isConnected;
    }
    if (this.phase === PHASES.LAST_WORDS) return player.id === this.lastWordsPlayerId;
    if (this.phase === PHASES.DEFENSE_STAGE) return player.id === this.defensePlayerId;
    if (DAY_PHASES.has(this.phase)) return player.isAlive && !player.isSilenced;
    return false;
  }

  _alivePlayers() {
    return [...this.players.values()].filter((player) => player.isAlive);
  }

  _partnersOf(player: Player) {
    if (player.team !== TEAMS.MAFIA) return [];
    return [...this.players.values()]
      .filter((other) => other.team === TEAMS.MAFIA && other.id !== player.id)
      .map((other) => ({ id: other.id, name: other.name, isAlive: other.isAlive }));
  }

  _requirePlayer(playerId: string) {
    const player = this.players.get(playerId);
    assert(player, ErrorCodes.NOT_IN_ROOM, 'You are not seated in this room');
    return player;
  }

  _emitToPlayer(player: Player, event: string, payload: unknown) {
    if (player.socketId) {
      this.bus.to(player.socketId).emit(event, payload);
    }
  }

  _armTimer(durationMs: number, onExpire: () => void) {
    this._clearTimer();
    this.phaseEndsAt = Date.now() + durationMs;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        onExpire();
      } catch (error) {
        const detail = error instanceof GameError ? `${error.code}: ${error.message}` : error;
        logger.warn(`Room ${this.code} timer callback failed:`, detail);
      }
    }, durationMs);
  }

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
