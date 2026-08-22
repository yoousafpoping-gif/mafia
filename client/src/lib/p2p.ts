'use client';

/**
 * P2P transport — WebRTC data channels with Firebase Firestore as the
 * signaling relay. No broker server to host: guests and the host exchange
 * offers/answers/ICE through small Firestore docs, then everything else
 * flows peer-to-peer exactly like the old PeerJS setup.
 *
 * The public surface (RoomHost/RoomClient/HOST_SOCKET/Envelope) is the one
 * net.ts builds on: Envelope request/ack/emit semantics are unchanged.
 */
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  getDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { loadIceServers } from './ice';

export const HOST_SOCKET = '__host__';

export type Envelope =
  | { kind: 'emit'; event: string; payload: unknown }
  | { kind: 'request'; event: string; payload: unknown; ackId: string }
  | { kind: 'ack'; ackId: string; ok: boolean; data?: unknown; error?: { code: string; message: string } };

type Listener = (payload: unknown) => void;
type Handler = (payload: unknown, socketId: string) => unknown;

const SIGNAL_TIMEOUT_MS = 15_000;

function uid(): string {
  return crypto.randomUUID();
}

function requireDb() {
  if (!firebaseDb) {
    throw {
      code: 'FIREBASE_NOT_CONFIGURED',
      message: 'مفاتيح Firebase ناقصة — اللعبة محتاجة NEXT_PUBLIC_FIREBASE_*',
    };
  }
  return firebaseDb;
}

const toJson = (value: unknown) => JSON.stringify(value);
const fromJson = <T,>(raw: unknown): T | null => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

interface GuestDoc {
  offer?: string | null;
  answer?: string | null;
  candG?: string[];
  candH?: string[];
}

const peersCol = (code: string) => collection(requireDb(), 'rooms', code, 'peers');
const guestDoc = (code: string, peerId: string) => doc(requireDb(), 'rooms', code, 'peers', peerId);
/** مستندات Firestore لازم يبقى عدد شرايحها زوجي — حضور الهوست جوه peers نفسها */
const hostPresenceDoc = (code: string) => doc(requireDb(), 'rooms', code, 'peers', 'host');

/** قناة بيانات موثوقة زي PeerJS — رسائل Envelope نصية JSON مع طابور قبل الفتح */
class ChannelConn {
  readonly peer: string;
  readonly pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private queue: string[] = [];
  onOpen: (() => void) | null = null;
  onMessage: ((raw: string) => void) | null = null;
  onClose: (() => void) | null = null;

  private constructor(peer: string, pc: RTCPeerConnection) {
    this.peer = peer;
    this.pc = pc;
  }

  /** المرشحات (STUN/TURN) بتتحمل async — مصنع بدل constructor مباشر */
  static async create(peer: string): Promise<ChannelConn> {
    return new ChannelConn(peer, new RTCPeerConnection({ iceServers: await loadIceServers() }));
  }

  bindChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => {
      for (const msg of this.queue) {
        try {
          channel.send(msg);
        } catch {
          /* ignore */
        }
      }
      this.queue = [];
      this.onOpen?.();
    };
    channel.onmessage = (msg) => this.onMessage?.(msg.data as string);
    channel.onclose = () => this.onClose?.();
    channel.onerror = () => undefined;
  }

  get open() {
    return this.channel?.readyState === 'open';
  }

  send(msg: string) {
    if (this.channel?.readyState === 'open') {
      this.channel.send(msg);
    } else {
      this.queue.push(msg);
    }
  }

  close() {
    this.onClose = null;
    try {
      this.channel?.close();
    } catch {
      /* ignore */
    }
    try {
      this.pc.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * RoomHost — runs in the room creator's browser. Room code is the Firestore
 * room id; guests write offer docs, the host answers and keeps one data
 * channel per guest. Implements the io.to().emit() surface the engine
 * expects plus the request/ack layer and voice relay.
 */
export class RoomHost {
  /** net.ts بيعمل host.peer.destroy() في مسار الأخطاء — نفس الشكل */
  peer = { destroy: () => this.destroy() };
  code: string;
  conns = new Map<string, ChannelConn>();
  localListeners = new Map<string, Set<Listener>>();
  requestHandlers = new Map<string, Handler>();
  voiceJoined = new Set<string>();
  ready: Promise<void>;
  private rejectReady?: (reason: unknown) => void;
  private unsub?: Unsubscribe;
  private appliedGuestCands = new Map<string, number>();
  private answering = new Set<string>();
  private destroyed = false;
  private heartbeat?: number;
  private onPageHide?: () => void;

  constructor(code: string) {
    this.code = code;
    this.ready = new Promise<void>((resolve, reject) => {
      this.rejectReady = reject;
      this.start().then(resolve, reject);
    });
  }

  private async start() {
    await setDoc(hostPresenceDoc(this.code), { alive: true, updatedAt: serverTimestamp() });
    // نبضة حياة — الضيف بيرفض الأوضة لو آخر نبضة قديمة (تاب مقفول/مجمد)
    this.heartbeat = window.setInterval(() => {
      void updateDoc(hostPresenceDoc(this.code), { updatedAt: serverTimestamp() }).catch(
        () => undefined,
      );
    }, 50_000);
    this.onPageHide = () => {
      window.clearInterval(this.heartbeat);
      void deleteDoc(hostPresenceDoc(this.code)).catch(() => undefined);
    };
    window.addEventListener('pagehide', this.onPageHide);
    this.watchGuests();
  }

  private watchGuests() {
    this.unsub = onSnapshot(
      peersCol(this.code),
      (snap) => {
        for (const change of snap.docChanges()) {
          const peerId = change.doc.id;
          if (change.type === 'removed') {
            const conn = this.conns.get(peerId);
            if (conn) {
              conn.onClose = null;
              conn.close();
              this.conns.delete(peerId);
              this.appliedGuestCands.delete(peerId);
              this.handleClose(peerId);
            }
            continue;
          }
          void this.onGuestDoc(peerId, (change.doc.data() ?? {}) as GuestDoc);
        }
      },
      (err) => {
        if (!this.destroyed) this.rejectReady?.(err);
      },
    );
  }

  private async onGuestDoc(peerId: string, data: GuestDoc) {
    const offer = fromJson<RTCSessionDescriptionInit>(data.offer);

    if (offer && !data.answer && !this.answering.has(peerId)) {
      this.answering.add(peerId);
      try {
        let conn = this.conns.get(peerId);
        if (!conn) {
          conn = await ChannelConn.create(peerId);
          conn.onMessage = (raw) => this.handleMessage(conn!, raw);
          conn.onClose = () => this.handleClose(peerId);
          this.conns.set(peerId, conn);
        }
        conn.pc.ondatachannel = (event) => conn!.bindChannel(event.channel);
        conn.pc.onicecandidate = (event) => {
          if (event.candidate) {
            void updateDoc(guestDoc(this.code, peerId), {
              candH: arrayUnion(toJson(event.candidate.toJSON())),
            }).catch(() => undefined);
          }
        };
        await conn.pc.setRemoteDescription(offer);
        const answer = await conn.pc.createAnswer();
        await conn.pc.setLocalDescription(answer);
        await updateDoc(guestDoc(this.code, peerId), {
          answer: toJson({ type: answer.type, sdp: answer.sdp }),
        });
      } catch (err) {
        this.answering.delete(peerId);
        return;
      }
    }

    // trickle ICE من الضيف (نفس الوثيقة بتتجدد)
    const conn = this.conns.get(peerId);
    const cands = data.candG ?? [];
    const applied = this.appliedGuestCands.get(peerId) ?? 0;
    if (conn && cands.length > applied) {
      for (const raw of cands.slice(applied)) {
        const candidate = fromJson<RTCIceCandidateInit>(raw);
        if (candidate) void conn.pc.addIceCandidate(candidate).catch(() => undefined);
      }
      this.appliedGuestCands.set(peerId, cands.length);
    }
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
      for (const conn of this.conns.values()) conn.send(toJson({ kind: 'emit', event, payload }));
      this.emitLocal(event, payload);
    } else if (target === HOST_SOCKET) {
      this.emitLocal(event, payload);
    } else {
      this.conns.get(target)?.send(toJson({ kind: 'emit', event, payload }));
    }
  }

  pushTo(socketId: string, event: string, payload: unknown) {
    this.conns.get(socketId)?.send(toJson({ kind: 'emit', event, payload }));
  }

  private handleMessage(conn: ChannelConn, raw: string) {
    const msg = fromJson<Envelope>(raw);
    if (!msg || msg.kind !== 'request') return;
    const handler = this.requestHandlers.get(msg.event);
    try {
      const data = handler ? handler(msg.payload, conn.peer) : undefined;
      conn.send(toJson({ kind: 'ack', ackId: msg.ackId, ok: true, data } satisfies Envelope));
    } catch (error) {
      const shaped = error as { code?: string; message?: string };
      const payloadError = shaped?.code
        ? { code: shaped.code, message: shaped.message ?? 'Unexpected error' }
        : { code: 'INTERNAL_ERROR', message: shaped?.message ?? 'Unexpected error' };
      conn.send(toJson({ kind: 'ack', ackId: msg.ackId, ok: false, error: payloadError } satisfies Envelope));
    }
  }

  private handleClose(peerId: string) {
    this.conns.delete(peerId);
    this.voiceJoined.delete(peerId);
    this.appliedGuestCands.delete(peerId);
    this.emitLocal('voice:peer-left', { socketId: peerId });
    try {
      this.requestHandlers.get('__disconnect__')?.(null, peerId);
    } catch {
      /* ignore */
    }
  }

  localRequest(event: string, payload: unknown): unknown {
    const handler = this.requestHandlers.get(event);
    if (!handler) throw new Error(`No handler for ${event}`);
    return handler(payload, HOST_SOCKET);
  }

  relayVoice(fromSocketId: string, event: string, to: string, data: unknown) {
    if (to === HOST_SOCKET) {
      this.emitLocal(event, { from: fromSocketId, data });
    } else {
      this.pushTo(to, event, { from: fromSocketId, data });
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    if (this.onPageHide) window.removeEventListener('pagehide', this.onPageHide);
    this.unsub?.();
    for (const conn of this.conns.values()) {
      try {
        conn.send(toJson({ kind: 'emit', event: 'room:closed', payload: { reason: 'host-left' } } satisfies Envelope));
      } catch {
        /* ignore */
      }
      conn.close();
    }
    this.conns.clear();
    void deleteDoc(hostPresenceDoc(this.code)).catch(() => undefined);
  }
}

/**
 * RoomClient — each non-host player. Writes an offer doc for the room code,
 * waits for the host's answer, then talks over the data channel only.
 */
export class RoomClient {
  peer = { destroy: () => this.destroy() };
  hostCode: string;
  conn: ChannelConn | null = null;
  listeners = new Map<string, Set<Listener>>();
  ackHandlers = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  ready: Promise<void>;
  private peerId = uid();
  private resolveReady?: () => void;
  private rejectReady?: (reason: unknown) => void;
  private unsub?: Unsubscribe;
  private appliedHostCands = 0;
  private onClosedCb?: (reason: string) => void;
  private destroyed = false;
  private docReady: Promise<void> | null = null;

  constructor(hostCode: string) {
    this.hostCode = hostCode;
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      this.start().then(resolve, reject);
    });
  }

  private settleReady() {
    if (this.resolveReady) {
      this.resolveReady();
      this.resolveReady = undefined;
    }
  }

  private async start() {
    // فحص سريع: الأوضة موجودة والهورست حي؟ (نبضة الحياة لازم تكون طازجة)
    const presence = await getDoc(hostPresenceDoc(this.hostCode));
    if (!presence.exists()) {
      throw { type: 'peer-unavailable', code: 'ROOM_NOT_FOUND', message: 'الأوضة مش موجودة أو اتقفلت' };
    }
    const lastBeat = presence.data()?.updatedAt?.toMillis?.() ?? 0;
    if (lastBeat && Date.now() - lastBeat > 3 * 60_000) {
      throw { type: 'peer-unavailable', code: 'ROOM_CLOSED', message: 'صاحب الأوضة مقفّل — الأوضة دي انتهت خلاص' };
    }

    const conn = await ChannelConn.create(this.peerId);
    this.conn = conn;
    const channel = conn.pc.createDataChannel('reliable', { ordered: true });
    conn.bindChannel(channel);
    conn.onMessage = (raw) => this.handleMessage(raw);
    conn.onClose = () => {
      if (this.destroyed) return;
      this.emitLocal('room:closed', { reason: 'host-disconnected' });
      this.onClosedCb?.('host-disconnected');
    };

    // مرشحات ICE قبل إنشاء المستند بتتحفظ مؤقتًا وبعدين بتترفع مع أول كتابة
    const earlyCandidates: string[] = [];
    let docCreated = false;
    conn.pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const json = toJson(event.candidate.toJSON());
      if (docCreated || this.docReady) {
        void (this.docReady ?? Promise.resolve()).then(() =>
          updateDoc(guestDoc(this.hostCode, this.peerId), { candG: arrayUnion(json) }).catch(() => undefined),
        );
      } else {
        earlyCandidates.push(json);
      }
    };

    const offer = await conn.pc.createOffer();
    await conn.pc.setLocalDescription(offer);
    this.docReady = setDoc(guestDoc(this.hostCode, this.peerId), {
      offer: toJson({ type: offer.type, sdp: offer.sdp }),
      candG: earlyCandidates,
      candH: [],
      updatedAt: serverTimestamp(),
    }).then(() => {
      docCreated = true;
    });
    await this.docReady;

    // انتظار رد الهوست وترشيحاته — مع مهلة زمنية
    const timeout = window.setTimeout(() => {
      if (!this.destroyed && !conn.open) {
        this.rejectReady?.({ type: 'network', code: 'CONNECT_TIMEOUT', message: 'مفيش رد من الأوضة' });
        this.destroy();
      }
    }, SIGNAL_TIMEOUT_MS);

    this.unsub = onSnapshot(
      guestDoc(this.hostCode, this.peerId),
      (snap) => {
        const data = (snap.data() ?? {}) as GuestDoc;
        const answer = fromJson<RTCSessionDescriptionInit>(data.answer);
        if (answer && conn.pc.signalingState === 'have-local-offer') {
          void conn.pc.setRemoteDescription(answer).catch(() => undefined);
        }
        const cands = data.candH ?? [];
        if (cands.length > this.appliedHostCands) {
          for (const raw of cands.slice(this.appliedHostCands)) {
            const candidate = fromJson<RTCIceCandidateInit>(raw);
            if (candidate) void conn.pc.addIceCandidate(candidate).catch(() => undefined);
          }
          this.appliedHostCands = cands.length;
        }
        if (conn.open) {
          window.clearTimeout(timeout);
          this.settleReady();
        }
      },
      (err) => {
        window.clearTimeout(timeout);
        this.rejectReady?.(err);
      },
    );

    conn.onOpen = () => {
      window.clearTimeout(timeout);
      this.settleReady();
    };
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

  private handleMessage(raw: string) {
    const msg = fromJson<Envelope>(raw);
    if (!msg) return;
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
      if (!this.conn) {
        reject({ code: 'NOT_CONNECTED', message: 'الاتصال بالهوست مقطوع — اخرج وادخل تاني' });
        return;
      }
      // ChannelConn.send بيطبّر الرسالة لحد ما القناة تفتح — مفيش رفض فوري
      // لو ready حلت والقناة لسه بتثبت (مهلة النداء الخارجية بتغطي الباقي)
      const ackId = uid();
      this.ackHandlers.set(ackId, { resolve, reject });
      this.conn.send(toJson({ kind: 'request', event, payload, ackId } satisfies Envelope));
    });
  }

  sendVoice(event: string, to: string, data: unknown) {
    if (!this.conn?.open) return;
    this.conn.send(toJson({ kind: 'request', event, payload: { to, data }, ackId: uid() } satisfies Envelope));
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsub?.();
    this.conn?.close();
    void deleteDoc(guestDoc(this.hostCode, this.peerId)).catch(() => undefined);
  }
}
