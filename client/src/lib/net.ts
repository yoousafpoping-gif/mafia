import { GameRoom } from './engine/GameRoom';
import { RoomHost, RoomClient, HOST_SOCKET } from './p2p';
import { sanitizeName } from './engine/validate';
import { randomCode } from './engine/random';
import { saveSeat } from './seat';
import type { GameState, AppError, JoinSuccess } from './types';

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
      const payload = (rawPayload ?? {}) as { token?: string | null; name?: string };
      if (payload.token) {
        const player = engine.reattach({ token: payload.token, socketId });
        return {
          code: engine.code,
          playerId: player.id,
          token: player.token,
          rejoined: true,
          state: engine.privateState(player.id),
        } as JoinSuccess;
      }
      const player = engine.addPlayer({ name: payload.name ?? '', socketId });
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
    bySocket(socketId);
    engine.startGame(socketId);
    return { state: engine.privateState(socketId) };
  }));

  host.requestHandlers.set('game:sync', wrap((_p: unknown, socketId: string) => {
    bySocket(socketId);
    return { state: engine.privateState(socketId) };
  }));

  host.requestHandlers.set('action:night_ability', wrap((payload: unknown, socketId: string) => {
    bySocket(socketId);
    const { targetId } = (payload ?? {}) as { targetId?: string | null };
    engine.submitNightAction(socketId, targetId ?? null);
    return { submitted: true };
  }));

  host.requestHandlers.set('action:good_boy_revenge', wrap((payload: unknown, socketId: string) => {
    bySocket(socketId);
    const { targetId } = (payload ?? {}) as { targetId?: string | null };
    engine.submitRevenge(socketId, targetId ?? null);
    return { submitted: true };
  }));

  host.requestHandlers.set('action:mayor_reveal', wrap((_p: unknown, socketId: string) => {
    bySocket(socketId);
    engine.revealMayor(socketId);
    return { revealed: true };
  }));

  host.requestHandlers.set('action:vote', wrap((payload: unknown, socketId: string) => {
    bySocket(socketId);
    const { targetId } = (payload ?? {}) as { targetId?: string };
    engine.castVote(socketId, targetId ?? '');
    return { voted: true };
  }));

  host.requestHandlers.set('game:add_bot', wrap((payload: unknown, socketId: string) => {
    bySocket(socketId);
    const { count } = (payload ?? {}) as { count?: number };
    engine.addBot(socketId, count ?? 1);
    return { state: engine.privateState(socketId) };
  }));

  host.requestHandlers.set('room:rematch_vote', wrap((payload: unknown, socketId: string) => {
    bySocket(socketId);
    const { ready } = (payload ?? {}) as { ready?: boolean };
    const vote = engine.voteRematch(socketId, ready !== false);
    return { state: engine.publicState(), ...vote };
  }));

  host.requestHandlers.set('game:request_play_again', wrap((_p: unknown, socketId: string) => {
    bySocket(socketId);
    const outcome = engine.requestPlayAgain(socketId);
    return { outcome, state: engine.publicState() };
  }));

  host.requestHandlers.set('chat:message', wrap((payload: unknown, socketId: string) => {
    bySocket(socketId);
    const { text } = (payload ?? {}) as { text?: string };
    return engine.postChat(socketId, text ?? '');
  }));

  host.requestHandlers.set('reaction:send', wrap((payload: unknown, socketId: string) => {
    bySocket(socketId);
    const { emojiId } = (payload ?? {}) as { emojiId?: string };
    engine.sendReaction(socketId, emojiId ?? '');
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
    const remotes = [...host.conns.keys()];
    const participants = [HOST_SOCKET, ...remotes];
    const peerList = participants.filter((id) => id !== socketId);
    host.voiceJoined.add(socketId);
    if (socketId !== HOST_SOCKET) {
      for (const id of host.voiceJoined) {
        if (id === socketId) continue;
        if (id === HOST_SOCKET) host.emitLocal('voice:peer-joined', { socketId });
        else host.pushTo(id, 'voice:peer-joined', { socketId });
      }
    }
    return { peers: peerList };
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
}

function makeHostNet(host: RoomHost, engine: GameRoom, code: string): RoomNet {
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
    sendVoice: (event, to, data) => host.relayVoice(HOST_SOCKET, event, to, data),
    leave: () => host.destroy(),
    destroy: () => host.destroy(),
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

/** Creator automatically becomes the host — its Peer id is the room code. */
export async function createHostNet(name: string): Promise<RoomNet> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode(6);
    const host = new RoomHost(code);
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
    const engine = new GameRoom(host, code, { name: sanitizeName(name), socketId: HOST_SOCKET });
    registerHostHandlers(host, engine);
    const net = makeHostNet(host, engine, code);
    setRoomNet(net);
    return net;
  }
  throw new ServerError({
    code: (lastError as { code?: string })?.code ?? 'HOST_ERROR',
    message: 'تعذر تشغيل الأوضة بعد عدة محاولات',
  });
}

/** Other players join the host's room using its Room Code. */
export async function createPeerNet(rawCode: string, name: string, token?: string): Promise<RoomNet> {
  const code = rawCode.trim().toUpperCase();
  const client = new RoomClient(code);
  try {
    await withTimeout(client.ready, 12_000, 'CONNECT_FAILED', 'مقدرناش نتصل بالهوست — تأكد الكود صح');
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
      client.sendRequest('room:join', { code, name: sanitizeName(name), token: token ?? null }),
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
