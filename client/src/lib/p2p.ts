import Peer from 'peerjs';
import type { DataConnection, PeerOptions } from 'peerjs';

export const HOST_SOCKET = '__host__';

export type Envelope =
  | { kind: 'emit'; event: string; payload: unknown }
  | { kind: 'request'; event: string; payload: unknown; ackId: string }
  | { kind: 'ack'; ackId: string; ok: boolean; data?: unknown; error?: { code: string; message: string } };

type Listener = (payload: unknown) => void;
type Handler = (payload: unknown, socketId: string) => unknown;

function uid(): string {
  return crypto.randomUUID();
}

// peerjs builds its URLs as `path + "peerjs"` — the path MUST end with a slash,
// otherwise the client would request /peerjspeerjs instead of /peerjs/peerjs.
const DEV_BROKER: PeerOptions = { host: 'localhost', port: 9000, path: '/peerjs/', secure: false };

/**
 * Broker selection — self-hosted PeerJS only, no public-cloud dependency:
 * 1. NEXT_PUBLIC_PEER_SERVER (production) — full URL of our own server,
 *    e.g. https://mafia-server-xxxx.onrender.com/peerjs (mounted on the game
 *    server) or https://mafia-peer-xxxx.onrender.com (standalone server/peerjs).
 * 2. localhost dev → the local peer server (server/peerjs, port 9000).
 * 3. Anything else → peerjs defaults, with a loud error: self-hosting was
 *    never wired up and room creation will be unreliable.
 */
function brokerOptions(): PeerOptions {
  const configured = process.env.NEXT_PUBLIC_PEER_SERVER;
  if (configured) {
    try {
      const url = new URL(configured);
      const secure = url.protocol === 'https:';
      return {
        host: url.hostname,
        port: url.port ? Number(url.port) : secure ? 443 : 80,
        path: url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`,
        secure,
      };
    } catch {
      console.error(`[p2p] Invalid NEXT_PUBLIC_PEER_SERVER URL: ${configured}`);
    }
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return { ...DEV_BROKER };
  }
  console.error(
    '[p2p] NEXT_PUBLIC_PEER_SERVER is not set — falling back to the public PeerJS cloud. ' +
      'Deploy server/peerjs (or use the /peerjs mount on the game server) and rebuild with it set.',
  );
  return {};
}

/**
 * RoomHost — runs in the room creator's browser. Its Peer id IS the room code,
 * so other players connect to it directly via PeerJS (WebRTC data channels).
 * It implements the `io.to(target).emit()` surface the engine expects, plus a
 * request/ack layer for inbound peer actions, and relays voice signaling.
 */
export class RoomHost {
  peer: Peer;
  code: string;
  conns = new Map<string, DataConnection>();
  localListeners = new Map<string, Set<Listener>>();
  requestHandlers = new Map<string, Handler>();
  voiceJoined = new Set<string>();
  ready: Promise<void>;
  private rejectReady?: (reason: unknown) => void;

  constructor(code: string) {
    this.code = code;
    this.peer = new Peer(code, brokerOptions());
    this.ready = new Promise<void>((resolve, reject) => {
      this.rejectReady = reject;
      this.peer.on('open', () => resolve());
      this.peer.on('error', (err: unknown) => {
        // id collision or broker issue — let the caller retry with a new code.
        reject(err);
      });
    });

    this.peer.on('connection', (conn: DataConnection) => {
      conn.on('open', () => this.conns.set(conn.peer, conn));
      conn.on('data', (msg: unknown) => this.handleMessage(conn, msg as Envelope));
      conn.on('close', () => this.handleClose(conn));
      conn.on('error', () => undefined);
    });
  }

  on<T = unknown>(event: string, cb: (payload: T) => void) {
    if (!this.localListeners.has(event)) this.localListeners.set(event, new Set());
    this.localListeners.get(event)!.add(cb as unknown as Listener);
  }

  off<T = unknown>(event: string, cb: (payload: T) => void) {
    this.localListeners.get(event)?.delete(cb as unknown as Listener);
  }

  emitLocal(event: string, payload: unknown) {
    this.localListeners.get(event)?.forEach((cb) => cb(payload));
  }

  /** io.to(target).emit(event, payload) — target may be a code, the host socket, or an array. */
  to(target: string | string[]) {
    const targets = Array.isArray(target) ? target : [target];
    return {
      emit: (event: string, payload: unknown) => {
        for (const t of targets) this.deliver(t, event, payload);
      },
    };
  }

  private deliver(target: string, event: string, payload: unknown) {
    if (target === this.code) {
      for (const conn of this.conns.values()) conn.send({ kind: 'emit', event, payload });
      this.emitLocal(event, payload);
    } else if (target === HOST_SOCKET) {
      this.emitLocal(event, payload);
    } else {
      this.conns.get(target)?.send({ kind: 'emit', event, payload });
    }
  }

  /** Send an emitted event to one specific remote peer (no local delivery). */
  pushTo(socketId: string, event: string, payload: unknown) {
    this.conns.get(socketId)?.send({ kind: 'emit', event, payload });
  }

  private handleMessage(conn: DataConnection, msg: Envelope) {
    if (msg.kind === 'request') {
      const handler = this.requestHandlers.get(msg.event);
      try {
        const data = handler ? handler(msg.payload, conn.peer) : undefined;
        conn.send({ kind: 'ack', ackId: msg.ackId, ok: true, data } as Envelope);
      } catch (error) {
        const shaped = error as { code?: string; message?: string };
        const payloadError = shaped?.code
          ? { code: shaped.code, message: shaped.message ?? 'Unexpected error' }
          : { code: 'INTERNAL_ERROR', message: shaped?.message ?? 'Unexpected error' };
        conn.send({ kind: 'ack', ackId: msg.ackId, ok: false, error: payloadError } as Envelope);
      }
    }
  }

  private handleClose(conn: DataConnection) {
    const socketId = conn.peer;
    this.conns.delete(socketId);
    this.voiceJoined.delete(socketId);
    this.emitLocal('voice:peer-left', { socketId });
    if (this.requestHandlers.has('__disconnect__')) {
      try {
        this.requestHandlers.get('__disconnect__')!(null, socketId);
      } catch {
        /* ignore */
      }
    }
  }

  /** Run a request handler locally (host's own actions). */
  localRequest(event: string, payload: unknown): unknown {
    const handler = this.requestHandlers.get(event);
    if (!handler) throw new Error(`No handler for ${event}`);
    return handler(payload, HOST_SOCKET);
  }

  /** Relay a voice signaling message: to === HOST_SOCKET goes local, else to that peer. */
  relayVoice(fromSocketId: string, event: string, to: string, data: unknown) {
    if (to === HOST_SOCKET) {
      this.emitLocal(event, { from: fromSocketId, data });
    } else {
      this.pushTo(to, event, { from: fromSocketId, data });
    }
  }

  destroy() {
    try {
      for (const conn of this.conns.values()) {
        try {
          conn.send({ kind: 'emit', event: 'room:closed', payload: { reason: 'host-left' } } as Envelope);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
    try {
      this.peer.destroy();
    } catch {
      /* ignore */
    }
  }
}

/**
 * RoomClient — runs in each non-host player's browser. Connects to the host
 * Peer (id = room code) and exchanges request/ack + emitted events.
 */
export class RoomClient {
  peer: Peer;
  hostCode: string;
  conn: DataConnection | null = null;
  listeners = new Map<string, Set<Listener>>();
  ackHandlers = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  ready: Promise<void>;
  private resolveReady?: () => void;
  private rejectReady?: (reason: unknown) => void;
  private onClosedCb?: (reason: string) => void;

  constructor(hostCode: string) {
    this.hostCode = hostCode;
    this.peer = new Peer(brokerOptions());
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      this.peer.on('open', () => this.connect());
      this.peer.on('error', (err: unknown) => reject(err));
    });
  }

  private connect() {
    const conn = this.peer.connect(this.hostCode, { reliable: true });
    this.conn = conn;
    conn.on('open', () => this.resolveReady?.());
    conn.on('data', (msg: unknown) => this.handleMessage(msg as Envelope));
    conn.on('close', () => {
      this.emitLocal('room:closed', { reason: 'host-disconnected' });
      this.onClosedCb?.('host-disconnected');
    });
    conn.on('error', () => undefined);
  }

  onClosed(cb: (reason: string) => void) {
    this.onClosedCb = cb;
  }

  on<T = unknown>(event: string, cb: (payload: T) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as unknown as Listener);
  }

  off<T = unknown>(event: string, cb: (payload: T) => void) {
    this.listeners.get(event)?.delete(cb as unknown as Listener);
  }

  private emitLocal(event: string, payload: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  private handleMessage(msg: Envelope) {
    if (msg.kind === 'emit') {
      this.emitLocal(msg.event, msg.payload);
    } else if (msg.kind === 'ack') {
      const entry = this.ackHandlers.get(msg.ackId);
      if (!entry) return;
      this.ackHandlers.delete(msg.ackId);
      if (msg.ok) entry.resolve(msg.data);
      else entry.reject(msg.error);
    }
  }

  sendRequest(event: string, payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.conn || !this.conn.open) {
        reject({ code: 'NOT_CONNECTED', message: 'Not connected to host' });
        return;
      }
      const ackId = uid();
      this.ackHandlers.set(ackId, { resolve, reject });
      this.conn.send({ kind: 'request', event, payload, ackId } as Envelope);
    });
  }

  /** Voice signaling from local useVoiceChat → host relay. */
  sendVoice(event: string, to: string, data: unknown) {
    if (!this.conn || !this.conn.open) return;
    this.conn.send({ kind: 'request', event, payload: { to, data }, ackId: uid() } as Envelope);
  }

  destroy() {
    try {
      this.conn?.send({ kind: 'request', event: 'room:leave', payload: {}, ackId: uid() } as Envelope);
    } catch {
      /* ignore */
    }
    try {
      this.peer.destroy();
    } catch {
      /* ignore */
    }
  }
}
