import { GameRoom } from './engine/GameRoom';
import { RoomHost, RoomClient, HOST_SOCKET, listPublicRoomCodes } from './p2p';
import { HOST_SNAPSHOT_VERSION, clearHostSnapshot, loadHostSnapshot, saveHostSnapshot } from './hostSnapshot';
import { sanitizeName } from './engine/validate';
import { randomCode } from './engine/random';
import { saveSeat } from './seat';
import type { GameState, AppError, JoinSuccess, PlayerCosmetics, RoomSettingsState } from './types';

export class ServerError extends Error {
  code: string;
  constructor(error: AppError) {
    super(error.message);
    this.name = 'ServerError';
    this.code = error.code;
  }
}

function errShape(err: unknown): AppError {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const shaped = err as { code: string; message?: string };
    return { code: shaped.code, message: shaped.message ?? 'Unexpected error' };
  }
  return { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : String(err) };
}

export interface RoomNet {
  isHost: boolean;
  code: string;
  connected: boolean;
  seated: boolean;
  on<T = unknown>(event: string, cb: (payload: T) => void): void;
  off<T = unknown>(event: string, cb: (payload: T) => void): void;
  request(event: string, payload?: unknown): Promise<unknown>;
  sync(): Promise<GameState>;
  sendVoice(event: string, to: string, data: unknown): void;
  leave(): void;
  destroy(): void;
}

let singleton: RoomNet | null = null;

export function getRoomNet(): RoomNet | null {
  return singleton;
}

export function setRoomNet(net: RoomNet | null) {
  singleton = net;
}

function withTimeout<T>(promise: Promise<T>, ms: number, code: string, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject({ code, message }), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function registerHostHandlers(host: RoomHost, engine: GameRoom) {
  const bySocket = (socketId: string) => {
    const player = [...engine.players.values()].find((p) => p.socketId === socketId);
    if (!player) throw { code: 'NOT_IN_ROOM', message: 'You are not seated in this room' };
    return player;
  };
  const wrap =
    (fn: (payload: unknown, socketId: string) => unknown) =>
    (payload: unknown, socketId: string): unknown => {
      try {
        return fn(payload, socketId);
      } catch (err) {
        throw errShape(err);
      }
    };

  host.requestHandlers.set(
    'room:join',
    wrap((rawPayload: unknown, socketId: string) => {
      const payload = (rawPayload ?? {}) as { token?: string | null; name?: string; cosmetics?: unknown };
      if (payload.token) {
        const player = engine.reattach({ token: payload.token, socketId, cosmetics: payload.cosmetics });
        return {
          code: engine.code,
          playerId: player.id,
          token: player.token,
          rejoined: true,
          state: engine.privateState(player.id),
        } as JoinSuccess;
      }
      const player = engine.addPlayer({ name: payload.name ?? '', socketId, cosmetics: payload.cosmetics });
      return {
        code: engine.code,
        playerId: player.id,
        token: player.token ?? '',
        rejoined: false,
        state: engine.privateState(player.id),
      } as JoinSuccess;
    }),
  );

  host.requestHandlers.set('game:start', wrap((_p: unknown, socketId: string) => {
    const player = bySocket(socketId);
    engine.startGame(player.id);
    return { state: engine.privateState(player.id) };
  }));

  host.requestHandlers.set('room:update_settings', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    engine.updateSettings(player.id, (payload ?? {}) as Parameters<GameRoom['updateSettings']>[1]);
    return { state: engine.privateState(player.id) };
  }));

  host.requestHandlers.set('room:kick', wrap((payload: unknown, socketId: string) => {
    const requester = bySocket(socketId);
    const { playerId } = (payload ?? {}) as { playerId?: string };
    const kicked = engine.kickPlayer(requester.id, playerId ?? '');
    if (kicked.socketId) {
      host.pushTo(kicked.socketId, 'room:kicked', {
        code: 'KICKED',
        message: 'صاحب الأوضة طردك من اللوبي',
      });
      host.disconnectPeer(kicked.socketId);
    }
    return { state: engine.privateState(requester.id) };
  }));

  host.requestHandlers.set('game:sync', wrap((_p: unknown, socketId: string) => {
    const player = bySocket(socketId);
    return { state: engine.privateState(player.id) };
  }));

  host.requestHandlers.set('action:night_ability', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const { targetId } = (payload ?? {}) as { targetId?: string | null };
    engine.submitNightAction(player.id, targetId ?? null);
    return { submitted: true };
  }));

  host.requestHandlers.set('action:good_boy_revenge', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const { targetId } = (payload ?? {}) as { targetId?: string | null };
    engine.submitRevenge(player.id, targetId ?? null);
    return { submitted: true };
  }));

  host.requestHandlers.set('action:mayor_reveal', wrap((_p: unknown, socketId: string) => {
    const player = bySocket(socketId);
    engine.revealMayor(player.id);
    return { revealed: true };
  }));

  host.requestHandlers.set('action:vote', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const { targetId } = (payload ?? {}) as { targetId?: string };
    engine.castVote(player.id, targetId ?? '');
    return { voted: true };
  }));

  host.requestHandlers.set('game:add_bot', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const { count } = (payload ?? {}) as { count?: number };
    engine.addBot(player.id, count ?? 1);
    return { state: engine.privateState(player.id) };
  }));

  host.requestHandlers.set('room:rematch_vote', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const { ready } = (payload ?? {}) as { ready?: boolean };
    const vote = engine.voteRematch(player.id, ready !== false);
    return { state: engine.publicState(), ...vote };
  }));

  host.requestHandlers.set('game:request_play_again', wrap((_p: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const outcome = engine.requestPlayAgain(player.id);
    return { outcome, state: engine.publicState() };
  }));

  host.requestHandlers.set('chat:message', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const { text, channel } = (payload ?? {}) as { text?: string; channel?: 'PUBLIC' | 'MAFIA' | 'DEAD' };
    return engine.postChat(player.id, text ?? '', channel);
  }));

  host.requestHandlers.set('reaction:send', wrap((payload: unknown, socketId: string) => {
    const player = bySocket(socketId);
    const { emojiId } = (payload ?? {}) as { emojiId?: string };
    engine.sendReaction(player.id, emojiId ?? '');
    return { sent: true };
  }));

  host.requestHandlers.set('room:leave', wrap((_p: unknown, socketId: string) => {
    if (socketId !== HOST_SOCKET) engine.handleDisconnect(socketId);
    return { left: true };
  }));

  host.requestHandlers.set('__disconnect__', (_p: unknown, socketId: string) => {
    if (socketId !== HOST_SOCKET) engine.handleDisconnect(socketId);
  });

  // --- voice signaling (host relays between peers) ---
  host.requestHandlers.set('voice:join', (_p: unknown, socketId: string) => {
    host.voiceJoined.add(socketId);
    // المنضم بيفتح اتصالات صوت لمن انضم فعلًا — مش كل الموصليين
    const peerList = [...host.voiceJoined].filter((id) => id !== socketId);
    if (socketId !== HOST_SOCKET) {
      for (const id of host.voiceJoined) {
        if (id === socketId) continue;
        if (id === HOST_SOCKET) host.emitLocal('voice:peer-joined', { socketId });
        else host.pushTo(id, 'voice:peer-joined', { socketId });
      }
    }
    // you = معرف المنضم في شبكة الصوت — لازم لقاعدة حسم تعارض العروض
    return { peers: peerList, you: socketId };
  });

  host.requestHandlers.set('voice:leave', (_p: unknown, socketId: string) => {
    host.voiceJoined.delete(socketId);
    for (const id of host.voiceJoined) {
      if (id === socketId) continue;
      if (id === HOST_SOCKET) host.emitLocal('voice:peer-left', { socketId });
      else host.pushTo(id, 'voice:peer-left', { socketId });
    }
    return { left: true };
  });

  const relay = (event: string) =>
    wrap((payload: unknown, socketId: string) => {
      const { to, data } = (payload ?? {}) as { to?: string; data?: unknown };
      host.relayVoice(socketId, event, to ?? '', data);
      return { relayed: true };
    });
  host.requestHandlers.set('voice:signal', relay('voice:signal'));
  host.requestHandlers.set('voice:ice', relay('voice:ice'));
  host.requestHandlers.set(
    'voice:speaking',
    wrap((payload: unknown, socketId: string) => {
      const { data } = (payload ?? {}) as { data?: { speaking?: boolean } };
      for (const id of host.voiceJoined) {
        if (id === socketId) continue;
        const eventPayload = { from: socketId, speaking: Boolean(data?.speaking) };
        if (id === HOST_SOCKET) host.emitLocal('voice:speaking', eventPayload);
        else host.pushTo(id, 'voice:speaking', eventPayload);
      }
      return { relayed: true };
    }),
  );
}

function makeHostNet(
  host: RoomHost,
  engine: GameRoom,
  code: string,
  hostToken: string,
  isPublic: boolean,
): RoomNet {
  const persist = () => saveHostSnapshot({
    version: HOST_SNAPSHOT_VERSION,
    code,
    hostToken,
    isPublic,
    savedAt: Date.now(),
    engine: engine.exportSnapshot(),
  });
  const interval = window.setInterval(persist, 2_000);
  const persistOnHide = () => persist();
  window.addEventListener('pagehide', persistOnHide);
  persist();
  const closeExplicitly = () => {
    window.clearInterval(interval);
    window.removeEventListener('pagehide', persistOnHide);
    clearHostSnapshot(code);
    engine.dispose();
    host.destroy();
  };
  return {
    isHost: true,
    code,
    connected: true,
    seated: true,
    on: (event, cb) => host.on(event, cb),
    off: (event, cb) => host.off(event, cb),
    request: async (event, payload) => {
      try {
        return await Promise.resolve(host.localRequest(event, payload));
      } catch (err) {
        throw new ServerError(errShape(err));
      }
    },
    sync: async () => {
      const data = host.localRequest('game:sync', {}) as { state: GameState };
      return data.state;
    },
    sendVoice: (event, to, data) => {
      if (event === 'voice:speaking') {
        for (const id of host.voiceJoined) {
          if (id === HOST_SOCKET) continue;
          host.pushTo(id, 'voice:speaking', {
            from: HOST_SOCKET,
            speaking: Boolean((data as { speaking?: boolean })?.speaking),
          });
        }
        return;
      }
      host.relayVoice(HOST_SOCKET, event, to, data);
    },
    leave: closeExplicitly,
    destroy: closeExplicitly,
  };
}

function makePeerNet(client: RoomClient, code: string): RoomNet {
  return {
    isHost: false,
    code,
    connected: true,
    seated: true,
    on: (event, cb) => client.on(event, cb),
    off: (event, cb) => client.off(event, cb),
    request: async (event, payload) => {
      try {
        return await client.sendRequest(event, payload);
      } catch (err) {
        throw new ServerError(errShape(err));
      }
    },
    sync: async () => {
      const data = (await client.sendRequest('game:sync', {})) as { state: GameState };
      return data.state;
    },
    sendVoice: (event, to, data) => client.sendVoice(event, to, data),
    leave: () => client.destroy(),
    destroy: () => client.destroy(),
  };
}

/** كوزمتكس اللاعب المجهّزة اللي بتسافر مع الانضمام — عرض فقط */
export type JoinCosmetics = PlayerCosmetics;

/** Creator automatically becomes the host — its Peer id is the room code. */
export async function createHostNet(
  name: string,
  isPublic = false,
  settings?: Partial<RoomSettingsState>,
  cosmetics?: JoinCosmetics,
  isCustomRoom = false,
): Promise<RoomNet> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode(6);
    const hostToken = crypto.randomUUID();
    const host = new RoomHost(code, isPublic, hostToken);
    try {
      await withTimeout(host.ready, 12_000, 'HOST_TIMEOUT', 'تعذر تشغيل الأوضة — جرّب تاني');
    } catch (err) {
      try {
        host.peer.destroy();
      } catch {
        /* ignore */
      }
      lastError = err;
      // Retry on id collision; other errors are surfaced to the caller.
      const shaped = err as { type?: string };
      if (shaped?.type === 'unavailable-id') continue;
      throw new ServerError(errShape(err));
    }
    const engine = new GameRoom(host, code, { name: sanitizeName(name), socketId: HOST_SOCKET, cosmetics }, isCustomRoom);
    if (settings) {
      const hostPlayer = [...engine.players.values()].find((player) => player.isHost);
      if (!hostPlayer) throw new ServerError({ code: 'HOST_ERROR', message: 'تعذر تجهيز صاحب الأوضة' });
      engine.updateSettings(hostPlayer.id, settings);
    }
    registerHostHandlers(host, engine);
    const net = makeHostNet(host, engine, code, hostToken, isPublic);
    setRoomNet(net);
    return net;
  }
  throw new ServerError({
    code: (lastError as { code?: string })?.code ?? 'HOST_ERROR',
    message: 'تعذر تشغيل الأوضة بعد عدة محاولات',
  });
}

export async function restoreHostNet(rawCode: string): Promise<RoomNet | null> {
  const code = rawCode.trim().toUpperCase();
  const saved = loadHostSnapshot(code);
  if (!saved) return null;
  const host = new RoomHost(code, saved.isPublic, saved.hostToken);
  try {
    await withTimeout(host.ready, 12_000, 'HOST_RESTORE_TIMEOUT', 'تعذر استعادة الأوضة');
    const engine = GameRoom.restore(host, saved.engine);
    registerHostHandlers(host, engine);
    const net = makeHostNet(host, engine, code, saved.hostToken, saved.isPublic);
    setRoomNet(net);
    return net;
  } catch (error) {
    host.destroy();
    throw new ServerError(errShape(error));
  }
}

export async function findPublicRoomNet(name: string, cosmetics?: JoinCosmetics): Promise<RoomNet> {
  const codes = await listPublicRoomCodes();
  for (const code of codes) {
    try {
      return await createPeerNet(code, name, undefined, cosmetics);
    } catch {
      // Stale/full room: try the next advertised room.
    }
  }
  throw new ServerError({ code: 'NO_PUBLIC_ROOMS', message: 'مفيش أوض متاحة دلوقتي' });
}

/** Other players join the host's room using its Room Code. */
export async function createPeerNet(rawCode: string, name: string, token?: string, cosmetics?: JoinCosmetics): Promise<RoomNet> {
  const code = rawCode.trim().toUpperCase();
  const client = new RoomClient(code);
  try {
    // p2p عنده مهلة داخلية 15ث برسالة أدق — دي شبكة أمان 18ث
    await withTimeout(
      client.ready,
      18_000,
      'CONNECT_FAILED',
      'مقدرناش نوصل لصاحب الأوضة — لو انت على موبايل داتا وهو على وايفاي جرب توصلوا على نفس الشبكة',
    );
  } catch (err) {
    try {
      client.peer.destroy();
    } catch {
      /* ignore */
    }
    throw new ServerError(errShape(err));
  }

  let res: JoinSuccess;
  try {
    res = (await withTimeout(
      client.sendRequest('room:join', { code, name: sanitizeName(name), token: token ?? null, cosmetics: cosmetics ?? null }),
      12_000,
      'JOIN_TIMEOUT',
      'مفيش رد من الأوضة — الكود غالبًا غلط',
    )) as JoinSuccess;
  } catch (err) {
    try {
      client.peer.destroy();
    } catch {
      /* ignore */
    }
    throw new ServerError(errShape(err));
  }

  saveSeat({
    code: res.code,
    playerId: res.playerId,
    token: res.token,
    name: res.state?.you?.name ?? name,
  });
  const net = makePeerNet(client, res.code);
  setRoomNet(net);
  return net;
}
