'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRoomNet } from '@/lib/net';
import { loadIceServers } from '@/lib/ice';
import type { GameState, VoicePolicy } from '@/lib/types';

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface VoiceController {
  joined: boolean;
  status: VoiceStatus;
  micOn: boolean;
  micLocked: boolean;
  lockReason: string | null;
  channelLabel: string;
  peerIds: string[];
  speakingIds: string[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  toggleMic: () => void;
}

export function useVoiceChat(
  state: GameState | null,
  policy: VoicePolicy | null,
): VoiceController {
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [micOn, setMicOn] = useState(true);
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const audioElsRef = useRef(new Map<string, HTMLAudioElement>());
  const streamRef = useRef<MediaStream | null>(null);
  const iceBuffersRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const joinedRef = useRef(false);
  const micOnRef = useRef(true);
  // معرفي في شبكة الصوت (socketId) — بيجي مع رد voice:join
  const myIdRef = useRef<string | null>(null);

  // --- Talking detection (WebRTC analysers) ---
  interface AnalyserEntry {
    analyser: AnalyserNode;
    data: Uint8Array<ArrayBuffer>;
    src: MediaStreamAudioSourceNode;
  }
  const analysersRef = useRef(new Map<string, AnalyserEntry>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speakingRef = useRef(new Set<string>());
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);

  const attachAnalyser = useCallback((peerId: string, stream: MediaStream) => {
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') void audioCtx.resume();

      const previous = analysersRef.current.get(peerId);
      if (previous) {
        try {
          previous.src.disconnect();
        } catch {
          /* already disconnected */
        }
      }

      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser); // analysis-only tap: never routed to output
      analysersRef.current.set(peerId, {
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount),
        src,
      });
    } catch {
      /* analyser unavailable */
    }
  }, []);

  const detachAnalyser = useCallback((peerId: string) => {
    const entry = analysersRef.current.get(peerId);
    if (!entry) return;
    try {
      entry.src.disconnect();
    } catch {
      /* ignore */
    }
    analysersRef.current.delete(peerId);
    speakingRef.current.delete(peerId);
    setSpeakingIds((current) => current.filter((id) => id !== peerId));
  }, []);

  const syncPeers = useCallback(() => {
    setPeerIds([...pcsRef.current.keys()]);
  }, []);

  const attachAudio = useCallback(
    (peerId: string, stream: MediaStream) => {
      let element = audioElsRef.current.get(peerId);
      if (!element) {
        element = document.createElement('audio');
        element.autoplay = true;
        element.dataset.peer = peerId;
        document.body.appendChild(element);
        audioElsRef.current.set(peerId, element);
      }
      element.srcObject = stream;
      void element.play().catch(() => {
        // الموبايل بيحبب التشغيل التلقائي — أول لمسة/ضغطة بتحاول تفتح الصوت تاني
        const unlock = () => {
          for (const el of audioElsRef.current.values()) {
            void el.play().catch(() => undefined);
          }
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: false });
        window.addEventListener('keydown', unlock, { once: false });
      });
      attachAnalyser(peerId, stream);
    },
    [attachAnalyser],
  );

  const teardownPeer = useCallback(
    (peerId: string) => {
      const pc = pcsRef.current.get(peerId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pcsRef.current.delete(peerId);
      }
      iceBuffersRef.current.delete(peerId);
      detachAnalyser(peerId);
      const el = audioElsRef.current.get(peerId);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElsRef.current.delete(peerId);
      }
      syncPeers();
    },
    [detachAnalyser, syncPeers],
  );

  const ensurePeer = useCallback(
    async (peerId: string): Promise<RTCPeerConnection> => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: await loadIceServers() });
      pcsRef.current.set(peerId, pc);

      const local = streamRef.current;
      if (local) {
        for (const track of local.getTracks()) pc.addTrack(track, local);
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && joinedRef.current) {
          getRoomNet()?.sendVoice('voice:ice', peerId, event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) attachAudio(peerId, stream);
      };

      pc.onconnectionstatechange = () => {
        // 'disconnected' ممكن يرجع لوحده (ICE بيعيد التوصيل) — بنهدّم بس لما يفشل فعلًا
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          teardownPeer(peerId);
        }
      };

      syncPeers();
      return pc;
    },
    [attachAudio, syncPeers, teardownPeer],
  );

  const offerTo = useCallback(
    async (peerId: string) => {
      try {
        const pc = await ensurePeer(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getRoomNet()?.sendVoice('voice:signal', peerId, {
          type: offer.type,
          sdp: offer.sdp,
        });
      } catch {
        teardownPeer(peerId);
      }
    },
    [ensurePeer, teardownPeer],
  );

  const join = useCallback(async () => {
    if (joinedRef.current || status === 'connecting') return;
    setStatus('connecting');
    setError(null);

    try {
      const net = getRoomNet();
      if (!net) throw new Error('مفيش اتصال بالأوضة');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      streamRef.current = stream;
      attachAnalyser('__self__', stream);

      const seat = (await net.request('voice:join')) as { peers: string[]; you: string };
      myIdRef.current = seat.you;
      joinedRef.current = true;
      setJoined(true);

      for (const peerId of seat.peers) {
        await offerTo(peerId);
      }
      setStatus('live');
    } catch (err) {
      teardownAll(pcsRef, audioElsRef, streamRef, iceBuffersRef);
      detachAnalyser('__self__');
      joinedRef.current = false;
      setJoined(false);
      setStatus('error');
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'مسموحش بالمايك — ادخل إعدادات المتصفح واسمح بالميكروفون'
          : err instanceof Error
            ? err.message
            : 'مقدرناش نفتح الصوت',
      );
    }
  }, [attachAnalyser, detachAnalyser, offerTo, status]);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    void getRoomNet()
      ?.request('voice:leave')
      .catch(() => undefined);
    teardownAll(pcsRef, audioElsRef, streamRef, iceBuffersRef);
    joinedRef.current = false;
    setJoined(false);
    setPeerIds([]);
    setStatus('idle');
  }, []);

  useEffect(() => {
    const net = getRoomNet();
    if (!net) return;

    // المنضم الجديد هو اللي بيفتح الاتصالات (بيوصل مع رد voice:join) —
    // الموجودين مايقدموش offers عشان مايتصادمش عرضين ويتدمروا (glare)

    const onSignal = async ({ from, data }: { from: string; data: RTCSessionDescriptionInit }) => {
      if (!joinedRef.current) return;
      try {
        const pc = await ensurePeer(from);
        // تعارض عروض (اتنين دخلو نفس اللحظة): الأصغر معرفًا بيرجع بعرضه
        // ويقبل الوارد، والأكبر بيتجاهله — النتيجة عرض واحد بس يكسب
        if (data.type === 'offer' && pc.signalingState === 'have-local-offer') {
          const polite = (myIdRef.current ?? '') < from;
          if (!polite) return;
          await pc.setLocalDescription({ type: 'rollback' }).catch(() => undefined);
        }
        await pc.setRemoteDescription(data);
        const buffered = iceBuffersRef.current.get(from) ?? [];
        iceBuffersRef.current.set(from, []);
        for (const candidate of buffered) {
          await pc.addIceCandidate(candidate).catch(() => undefined);
        }
        if (data.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          net.sendVoice('voice:signal', from, { type: answer.type, sdp: answer.sdp });
        }
      } catch {
        // وصف متأخر/تالف مش نهاية العالم — لو الاتصال فعلًا مكسور
        // connectionState هيوصل failed وهيتنضف لوحده
      }
    };

    const onIce = ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (!joinedRef.current) return;
      const pc = pcsRef.current.get(from);
      if (pc?.remoteDescription) {
        void pc.addIceCandidate(candidate).catch(() => undefined);
      } else {
        const buffer = iceBuffersRef.current.get(from) ?? [];
        buffer.push(candidate);
        iceBuffersRef.current.set(from, buffer);
      }
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      teardownPeer(socketId);
    };

    net.on('voice:signal', onSignal);
    net.on('voice:ice', onIce);
    net.on('voice:peer-left', onPeerLeft);

    return () => {
      net.off('voice:signal', onSignal);
      net.off('voice:ice', onIce);
      net.off('voice:peer-left', onPeerLeft);
    };
  }, [ensurePeer, teardownPeer]);

  useEffect(() => {
    for (const [peerId, element] of audioElsRef.current.entries()) {
      const audible = Boolean(policy?.canHear && policy.audible.includes(peerId));
      element.muted = !audible;
    }

    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = Boolean(policy?.canSpeak && micOnRef.current);
  }, [policy, peerIds]);

  useEffect(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = Boolean(policy?.canSpeak && micOn);
  }, [micOn, policy]);

  useEffect(() => {
    const analysers = analysersRef.current;
    const audioCtx = audioCtxRef.current;
    return () => {
      void getRoomNet()
        ?.request('voice:leave')
        .catch(() => undefined);
      teardownAll(pcsRef, audioElsRef, streamRef, iceBuffersRef);
      for (const [peerId, entry] of analysers.entries()) {
        try {
          entry.src.disconnect();
        } catch {
          /* ignore */
        }
        speakingRef.current.delete(peerId);
      }
      analysers.clear();
      setSpeakingIds([]);
      if (audioCtx) {
        void audioCtx.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
      joinedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!joined) return;
    const tick = () => {
      const next = new Set<string>();
      for (const [peerId, entry] of analysersRef.current.entries()) {
        entry.analyser.getByteTimeDomainData(entry.data);
        let peak = 0;
        for (let i = 0; i < entry.data.length; i += 1) {
          peak = Math.max(peak, Math.abs(entry.data[i] - 128));
        }
        if (peak > 6) next.add(peerId);
      }
      const prev = speakingRef.current;
      const changed =
        prev.size !== next.size || [...next].some((id) => !prev.has(id));
      if (changed) {
        speakingRef.current = next;
        setSpeakingIds([...next]);
      }
    };
    const poll = window.setInterval(tick, 160);
    return () => window.clearInterval(poll);
  }, [joined]);

  const micLocked = !policy?.canSpeak;
  const channelLabel = channelLabelFor(policy, state?.you?.isAlive ?? true);
  const lockReason = micLocked
    ? policy?.channel === 'MUTED'
      ? 'سكت الليل — كل الخطوط مقفولة لحد الفجر'
      : policy?.channel === 'DEAD'
        ? 'إنت متفرج بس.. بتسمع ومش بتتسمع'
        : 'المافيا سكّتك'
    : null;

  return {
    joined,
    status,
    micOn,
    micLocked,
    lockReason,
    channelLabel,
    peerIds,
    speakingIds,
    error,
    join,
    leave,
    toggleMic: () => {
      if (!micLocked) setMicOn((value) => !value);
    },
  };
}

function channelLabelFor(policy: VoicePolicy | null, isAlive: boolean): string {
  if (!policy) return 'الصوت';
  switch (policy.channel) {
    case 'MAFIA':
      return 'خط العيلة';
    case 'TOWN':
      return policy.canSpeak ? 'ميك الأهالي' : 'الأهالي — سمع بس';
    case 'DEAD':
      return isAlive ? 'الصوت' : 'قاعة المتفرجين';
    case 'LOBBY':
      return 'صوت الأوضة';
    default:
      return 'سكات الليل';
  }
}

function teardownAll(
  pcsRef: React.RefObject<Map<string, RTCPeerConnection>>,
  audioElsRef: React.RefObject<Map<string, HTMLAudioElement>>,
  streamRef: React.RefObject<MediaStream | null>,
  iceBuffersRef: React.RefObject<Map<string, RTCIceCandidateInit[]>>,
) {
  for (const pc of pcsRef.current?.values() ?? []) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }
  pcsRef.current?.clear();
  for (const element of audioElsRef.current?.values() ?? []) {
    element.srcObject = null;
    element.remove();
  }
  audioElsRef.current?.clear();
  iceBuffersRef.current?.clear();
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}
