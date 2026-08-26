'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRoomNet } from '@/lib/net';
import { loadIceServers } from '@/lib/ice';
import type { GameState, VoicePolicy } from '@/lib/types';

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';
type PeerDebug = {
  connection: string;
  ice: string;
  signaling: string;
  localDescription: string;
  remoteDescription: string;
  localIceCandidates: number;
  remoteIceCandidates: number;
  remoteTrack: boolean;
  remoteAudio: string;
  lastError: string | null;
};
type VoiceDebug = {
  mic: string;
  ice: string;
  peers: Record<string, string>;
  peerDetails: Record<string, PeerDebug>;
  playback: string;
  lastError: string | null;
};

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
  debug: VoiceDebug;
  join: () => Promise<void>;
  leave: () => void;
  toggleMic: () => void;
}

const emptyPeerDebug = (): PeerDebug => ({
  connection: 'new',
  ice: 'new',
  signaling: 'stable',
  localDescription: 'none',
  remoteDescription: 'none',
  localIceCandidates: 0,
  remoteIceCandidates: 0,
  remoteTrack: false,
  remoteAudio: 'waiting',
  lastError: null,
});

export function useVoiceChat(
  state: GameState | null,
  policy: VoicePolicy | null,
): VoiceController {
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [micOn, setMicOn] = useState(true);
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<VoiceDebug>({
    mic: 'لسه ما اتفتحش',
    ice: 'STUN فقط لحد ما نتحقق من TURN',
    peers: {},
    peerDetails: {},
    playback: 'مستني صوت بعيد',
    lastError: null,
  });

  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const localIceCountsRef = useRef(new Map<string, number>());
  const remoteIceCountsRef = useRef(new Map<string, number>());
  const makingOfferRef = useRef(new Set<string>());
  const ignoreOfferRef = useRef(new Set<string>());
  const audioElsRef = useRef(new Map<string, HTMLAudioElement>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const streamRef = useRef<MediaStream | null>(null);
  const iceBuffersRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const pendingSignalsRef = useRef(new Map<string, RTCSessionDescriptionInit[]>());
  const joinedRef = useRef(false);
  const micOnRef = useRef(true);
  const policyRef = useRef<VoicePolicy | null>(policy);
  const myIdRef = useRef<string | null>(null);

  interface AnalyserEntry {
    analyser: AnalyserNode;
    data: Uint8Array<ArrayBuffer>;
    src: MediaStreamAudioSourceNode;
  }
  const analysersRef = useRef(new Map<string, AnalyserEntry>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speakingRef = useRef(new Set<string>());
  const broadcastSpeakingRef = useRef(false);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);

  useEffect(() => {
    policyRef.current = policy;
  }, [policy]);

  const updatePeerDebug = useCallback((peerId: string, patch: Partial<PeerDebug>) => {
    setDebug((current) => {
      const nextDetail = { ...(current.peerDetails[peerId] ?? emptyPeerDebug()), ...patch };
      const summary = `PC:${nextDetail.connection} ICE:${nextDetail.ice} SIG:${nextDetail.signaling} LD:${nextDetail.localDescription} RD:${nextDetail.remoteDescription} ICEc:${nextDetail.localIceCandidates}/${nextDetail.remoteIceCandidates} track:${nextDetail.remoteTrack ? 'yes' : 'no'} audio:${nextDetail.remoteAudio}${nextDetail.lastError ? ` err:${nextDetail.lastError}` : ''}`;
      return {
        ...current,
        peers: { ...current.peers, [peerId]: summary },
        peerDetails: { ...current.peerDetails, [peerId]: nextDetail },
        lastError: patch.lastError ?? current.lastError,
      };
    });
  }, []);

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
      if (previous) previous.src.disconnect();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
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

  const applyAudibility = useCallback((peerId: string, element: HTMLAudioElement) => {
    const currentPolicy = policyRef.current;
    const audible = Boolean(currentPolicy?.canHear && currentPolicy.audible.includes(peerId));
    element.muted = !audible;
    updatePeerDebug(peerId, { remoteAudio: audible ? 'unmuted' : 'muted-by-game-policy' });
  }, [updatePeerDebug]);

  const unlockRemoteAudio = useCallback(() => {
    for (const [peerId, el] of audioElsRef.current.entries()) {
      applyAudibility(peerId, el);
      void el.play().then(
        () => updatePeerDebug(peerId, { remoteAudio: el.muted ? 'muted-by-game-policy' : 'playing' }),
        (err) => updatePeerDebug(peerId, { remoteAudio: 'blocked-until-tap', lastError: err instanceof Error ? err.message : 'play blocked' }),
      );
    }
  }, [applyAudibility, updatePeerDebug]);

  const attachAudio = useCallback(
    (peerId: string, stream: MediaStream) => {
      let element = audioElsRef.current.get(peerId);
      if (!element) {
        element = document.createElement('audio');
        element.autoplay = true;
        element.setAttribute('playsinline', 'true');
        element.controls = false;
        element.dataset.peer = peerId;
        element.style.display = 'none';
        document.body.appendChild(element);
        audioElsRef.current.set(peerId, element);
      }
      element.volume = 1;
      if (element.srcObject !== stream) element.srcObject = stream;
      applyAudibility(peerId, element);
      const tryPlay = () => {
        applyAudibility(peerId, element!);
        void element!
          .play()
          .then(() => {
            updatePeerDebug(peerId, { remoteAudio: element!.muted ? 'muted-by-game-policy' : 'playing' });
            setDebug((current) => ({ ...current, playback: 'تشغيل الصوت البعيد شغال' }));
          })
          .catch((err) => {
            updatePeerDebug(peerId, { remoteAudio: 'blocked-until-tap', lastError: err instanceof Error ? err.message : 'play blocked' });
            setDebug((current) => ({
              ...current,
              playback: 'المتصفح مانع التشغيل — دوس أي ضغطة على الشاشة لفتح الصوت',
              lastError: err instanceof Error ? err.message : 'play blocked',
            }));
          });
      };
      tryPlay();
      for (const track of stream.getAudioTracks()) {
        track.enabled = true;
        track.onunmute = tryPlay;
      }
      attachAnalyser(peerId, stream);
    },
    [applyAudibility, attachAnalyser, updatePeerDebug],
  );

  useEffect(() => {
    window.addEventListener('pointerdown', unlockRemoteAudio);
    window.addEventListener('keydown', unlockRemoteAudio);
    window.addEventListener('touchend', unlockRemoteAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockRemoteAudio);
      window.removeEventListener('keydown', unlockRemoteAudio);
      window.removeEventListener('touchend', unlockRemoteAudio);
    };
  }, [unlockRemoteAudio]);

  const teardownPeer = useCallback(
    (peerId: string) => {
      const pc = pcsRef.current.get(peerId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.onsignalingstatechange = null;
        pc.onnegotiationneeded = null;
        pc.close();
        pcsRef.current.delete(peerId);
      }
      makingOfferRef.current.delete(peerId);
      ignoreOfferRef.current.delete(peerId);
      localIceCountsRef.current.delete(peerId);
      remoteIceCountsRef.current.delete(peerId);
      iceBuffersRef.current.delete(peerId);
      pendingSignalsRef.current.delete(peerId);
      remoteStreamsRef.current.delete(peerId);
      detachAnalyser(peerId);
      const el = audioElsRef.current.get(peerId);
      if (el) {
        el.srcObject = null;
        el.remove();
        audioElsRef.current.delete(peerId);
      }
      setDebug((current) => {
        const peers = { ...current.peers };
        const peerDetails = { ...current.peerDetails };
        delete peers[peerId];
        delete peerDetails[peerId];
        return { ...current, peers, peerDetails };
      });
      syncPeers();
    },
    [detachAnalyser, syncPeers],
  );

  const sendDescription = useCallback((peerId: string, description: RTCSessionDescription | RTCSessionDescriptionInit | null) => {
    if (!description) {
      updatePeerDebug(peerId, { lastError: 'signal send skipped: missing localDescription' });
      return;
    }
    updatePeerDebug(peerId, { localDescription: `${description.type}:sending` });
    getRoomNet()?.sendVoice('voice:signal', peerId, { type: description.type, sdp: description.sdp });
    updatePeerDebug(peerId, { localDescription: `${description.type}:sent` });
  }, [updatePeerDebug]);

  const negotiatePeer = useCallback(
    async (peerId: string, options?: RTCOfferOptions) => {
      const pc = pcsRef.current.get(peerId);
      if (!pc) {
        updatePeerDebug(peerId, { lastError: 'offer skipped: no peer connection' });
        return;
      }
      if (pc.signalingState !== 'stable' || makingOfferRef.current.has(peerId)) {
        updatePeerDebug(peerId, { signaling: pc.signalingState, lastError: `offer skipped: busy (${pc.signalingState})` });
        return;
      }
      // مالك الاتصال الوحيد هو صاحب المعرّف الأصغر. ده يمنع أي عروض متزامنة
      // حتى أثناء watchdog أو ICE restart، ويضمن إن الطرف الآخر يرد فقط.
      if ((myIdRef.current ?? '') > peerId) return;
      try {
        makingOfferRef.current.add(peerId);
        updatePeerDebug(peerId, { signaling: pc.signalingState, lastError: options?.iceRestart ? 'creating ICE restart offer' : 'creating offer' });
        const offer = await pc.createOffer(options);
        updatePeerDebug(peerId, { localDescription: 'offer:created' });
        await pc.setLocalDescription(offer);
        updatePeerDebug(peerId, {
          signaling: pc.signalingState,
          localDescription: pc.localDescription?.type ? `${pc.localDescription.type}:setLocal-ok` : 'missing-after-setLocal',
          lastError: null,
        });
        sendDescription(peerId, pc.localDescription);
      } catch (err) {
        updatePeerDebug(peerId, {
          signaling: pc.signalingState,
          localDescription: pc.localDescription?.type ?? 'none',
          lastError: err instanceof Error ? `offer/setLocal failed: ${err.message}` : 'offer/setLocal failed',
        });
      } finally {
        makingOfferRef.current.delete(peerId);
      }
    },
    [sendDescription, updatePeerDebug],
  );

  const ensurePeer = useCallback(
    async (peerId: string): Promise<RTCPeerConnection> => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;
      const iceServers = await loadIceServers();
      setDebug((current) => ({
        ...current,
        ice: iceServers.some((server) => JSON.stringify(server.urls).toLowerCase().includes('turn:'))
          ? 'TURN/STUN جاهزين'
          : 'STUN فقط — لو الموبايل على شبكة مختلفة ممكن تحتاج TURN',
      }));
      const pc = new RTCPeerConnection({ iceServers });
      pcsRef.current.set(peerId, pc);
      updatePeerDebug(peerId, emptyPeerDebug());

      const local = streamRef.current;
      if (local) {
        for (const track of local.getAudioTracks()) pc.addTrack(track, local);
      }
      if (pc.getTransceivers().filter((t) => t.receiver.track.kind === 'audio').length === 0) {
        pc.addTransceiver('audio', { direction: local ? 'sendrecv' : 'recvonly' });
      }

      // التفاوض يبدأ صراحة من اللاعب المنضم فقط؛ onnegotiationneeded من الطرفين
      // كان بيولد عروض متزامنة ويترك الاتصال في have-local-offer.
      pc.onnegotiationneeded = null;

      pc.onicecandidate = (event) => {
        if (event.candidate && joinedRef.current) {
          const count = (localIceCountsRef.current.get(peerId) ?? 0) + 1;
          localIceCountsRef.current.set(peerId, count);
          updatePeerDebug(peerId, { localIceCandidates: count, lastError: `ICE gathered/sent #${count}` });
          getRoomNet()?.sendVoice('voice:ice', peerId, event.candidate.toJSON());
        } else if (!event.candidate) {
          updatePeerDebug(peerId, { lastError: 'ICE gathering complete' });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? remoteStreamsRef.current.get(peerId) ?? new MediaStream();
        if (!event.streams[0] && !stream.getTracks().some((track) => track.id === event.track.id)) {
          stream.addTrack(event.track);
        }
        remoteStreamsRef.current.set(peerId, stream);
        updatePeerDebug(peerId, { remoteTrack: true });
        attachAudio(peerId, stream);
      };

      pc.oniceconnectionstatechange = () => updatePeerDebug(peerId, { ice: pc.iceConnectionState });
      pc.onsignalingstatechange = () => updatePeerDebug(peerId, { signaling: pc.signalingState });
      pc.onconnectionstatechange = () => {
        updatePeerDebug(peerId, { connection: pc.connectionState });
        if (pc.connectionState === 'failed') {
          void pc.restartIce();
          updatePeerDebug(peerId, { lastError: 'ICE failed; restarting' });
        } else if (pc.connectionState === 'closed') {
          teardownPeer(peerId);
        }
      };

      syncPeers();
      return pc;
    },
    [attachAudio, negotiatePeer, syncPeers, teardownPeer, updatePeerDebug],
  );

  const addLocalTracksToAllPeers = useCallback(() => {
    const local = streamRef.current;
    if (!local) return;
    for (const [peerId, pc] of pcsRef.current.entries()) {
      for (const track of local.getAudioTracks()) {
        const alreadySending = pc.getSenders().some((sender) => sender.track?.id === track.id);
        if (!alreadySending) {
          pc.addTrack(track, local);
          updatePeerDebug(peerId, { signaling: pc.signalingState });
        }
      }
    }
  }, [updatePeerDebug]);

  const join = useCallback(async () => {
    if (joinedRef.current || status === 'connecting') return;
    setStatus('connecting');
    setError(null);
    try {
      const net = getRoomNet();
      if (!net) throw new Error('مفيش اتصال بالأوضة');
      // دخول قناة الصوت لا يعتمد على وجود ميكروفون. نحاول فتحه للإرسال،
      // لكن لو الجهاز بلا مايك أو الإذن مرفوض نكمل كـ recv-only ليستمع اللاعب.
      let stream: MediaStream | null = null;
      let micUnavailableReason: string | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
        } catch (micError) {
          micUnavailableReason =
            micError instanceof DOMException && micError.name === 'NotAllowedError'
              ? 'إذن الميكروفون مرفوض — داخل تسمع بس'
              : 'مفيش ميكروفون متاح — داخل تسمع بس';
        }
      } else {
        micUnavailableReason = 'الجهاز مفيهوش ميكروفون متاح — داخل تسمع بس';
      }

      const track = stream?.getAudioTracks()[0];
      if (stream && track) {
        streamRef.current = stream;
        track.enabled = Boolean(policyRef.current?.canSpeak ?? true);
        setDebug((current) => ({
          ...current,
          mic: `الميك اتفتح: ${track.label || 'microphone'} (${track.readyState})`,
          lastError: null,
        }));
        track.onended = () => {
          setDebug((current) => ({ ...current, mic: 'الميك اتقفل — الاستماع لسه شغال', lastError: 'microphone track ended' }));
          setMicOn(false);
        };
        attachAnalyser('__self__', stream);
      } else {
        stream?.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        streamRef.current = null;
        micOnRef.current = false;
        setMicOn(false);
        setDebug((current) => ({
          ...current,
          mic: micUnavailableReason ?? 'مفيش ميكروفون — داخل تسمع بس',
          lastError: null,
        }));
      }

      const seat = (await net.request('voice:join')) as { peers: string[]; you: string };
      myIdRef.current = seat.you;
      joinedRef.current = true;
      setJoined(true);
      setDebug((current) => ({
        ...current,
        playback: `دخلت الصوت كـ ${seat.you} — ${seat.peers.length} peers`,
      }));

      for (const peerId of seat.peers) {
        await ensurePeer(peerId);
        void negotiatePeer(peerId);
      }
      addLocalTracksToAllPeers();
      setStatus('live');
    } catch (err) {
      teardownAll(pcsRef, audioElsRef, remoteStreamsRef, streamRef, iceBuffersRef);
      detachAnalyser('__self__');
      joinedRef.current = false;
      setJoined(false);
      setStatus('error');
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'مسموحش بالمايك — ادخل إعدادات المتصفح واسمح بالميكروفون'
          : err instanceof Error
            ? err.message
            : 'مقدرناش نفتح الصوت';
      setError(message);
      setDebug((current) => ({ ...current, lastError: message }));
    }
  }, [addLocalTracksToAllPeers, attachAnalyser, detachAnalyser, ensurePeer, negotiatePeer, status]);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    void getRoomNet()?.request('voice:leave').catch(() => undefined);
    teardownAll(pcsRef, audioElsRef, remoteStreamsRef, streamRef, iceBuffersRef);
    joinedRef.current = false;
    setJoined(false);
    setPeerIds([]);
    setStatus('idle');
  }, []);

  useEffect(() => {
    const net = getRoomNet();
    if (!net) return;

    const applySignal = async (from: string, data: RTCSessionDescriptionInit) => {
      const pc = await ensurePeer(from);
      updatePeerDebug(from, { signaling: pc.signalingState, remoteDescription: `${data.type}:received` });
      const offerCollision = data.type === 'offer' && (makingOfferRef.current.has(from) || pc.signalingState !== 'stable');
      const polite = (myIdRef.current ?? '') > from;
      if (offerCollision && !polite) {
        ignoreOfferRef.current.add(from);
        updatePeerDebug(from, { lastError: `ignored glare offer from ${from}` });
        return;
      }
      ignoreOfferRef.current.delete(from);
      if (offerCollision) {
        await pc.setLocalDescription({ type: 'rollback' });
        updatePeerDebug(from, { signaling: pc.signalingState, localDescription: 'rollback:setLocal-ok' });
      }
      try {
        await pc.setRemoteDescription(data);
        updatePeerDebug(from, {
          signaling: pc.signalingState,
          remoteDescription: pc.remoteDescription?.type ? `${pc.remoteDescription.type}:setRemote-ok` : 'missing-after-setRemote',
          lastError: null,
        });
      } catch (err) {
        updatePeerDebug(from, {
          signaling: pc.signalingState,
          remoteDescription: pc.remoteDescription?.type ?? 'none',
          lastError: err instanceof Error ? `${data.type}:setRemote failed: ${err.message}` : `${data.type}:setRemote failed`,
        });
        throw err;
      }
      const buffered = iceBuffersRef.current.get(from) ?? [];
      iceBuffersRef.current.set(from, []);
      for (const candidate of buffered) {
        try {
          await pc.addIceCandidate(candidate);
          const count = (remoteIceCountsRef.current.get(from) ?? 0) + 1;
          remoteIceCountsRef.current.set(from, count);
          updatePeerDebug(from, { remoteIceCandidates: count, lastError: `buffered ICE applied #${count}` });
        } catch (err) {
          updatePeerDebug(from, { lastError: err instanceof Error ? `buffered ICE failed: ${err.message}` : 'buffered ICE failed' });
        }
      }
      if (data.type === 'offer') {
        try {
          updatePeerDebug(from, { localDescription: 'answer:creating' });
          await pc.setLocalDescription();
          updatePeerDebug(from, {
            signaling: pc.signalingState,
            localDescription: pc.localDescription?.type ? `${pc.localDescription.type}:setLocal-ok` : 'missing-answer-after-setLocal',
            lastError: null,
          });
          sendDescription(from, pc.localDescription);
        } catch (err) {
          updatePeerDebug(from, { lastError: err instanceof Error ? `answer/setLocal failed: ${err.message}` : 'answer/setLocal failed' });
          throw err;
        }
      } else if (data.type === 'answer') {
        updatePeerDebug(from, { remoteDescription: 'answer:applied' });
      }
    };

    const onSignal = async ({ from, data }: { from: string; data: RTCSessionDescriptionInit }) => {
      if (!from || from === myIdRef.current) return;
      if (!joinedRef.current) {
        const pending = pendingSignalsRef.current.get(from) ?? [];
        pending.push(data);
        pendingSignalsRef.current.set(from, pending);
        updatePeerDebug(from, { remoteDescription: `${data.type}:pending-before-join`, lastError: `signal buffered before join (${pending.length})` });
        return;
      }
      try {
        await applySignal(from, data);
      } catch (err) {
        updatePeerDebug(from, { lastError: err instanceof Error ? err.message : 'signal failed' });
      }
    };

    const onIce = ({ from, data }: { from: string; data: RTCIceCandidateInit }) => {
      if (!from || from === myIdRef.current) return;
      const candidate = data;
      if (ignoreOfferRef.current.has(from)) {
        updatePeerDebug(from, { lastError: 'ICE ignored because glare offer ignored' });
        return;
      }
      void ensurePeer(from).then((pc) => {
        if (!joinedRef.current || !pc.remoteDescription) {
          const buffer = iceBuffersRef.current.get(from) ?? [];
          buffer.push(candidate);
          iceBuffersRef.current.set(from, buffer);
          updatePeerDebug(from, { lastError: `ICE received/buffered (${buffer.length})` });
          return;
        }
        void pc.addIceCandidate(candidate)
          .then(() => {
            const count = (remoteIceCountsRef.current.get(from) ?? 0) + 1;
            remoteIceCountsRef.current.set(from, count);
            updatePeerDebug(from, { remoteIceCandidates: count, lastError: `ICE received/applied #${count}` });
          })
          .catch((err) => updatePeerDebug(from, { lastError: err instanceof Error ? `ICE apply failed: ${err.message}` : 'ICE apply failed' }));
      }).catch((err) => updatePeerDebug(from, { lastError: err instanceof Error ? `ensurePeer for ICE failed: ${err.message}` : 'ensurePeer for ICE failed' }));
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => teardownPeer(socketId);
    const onPeerJoined = ({ socketId }: { socketId: string }) => {
      if (joinedRef.current && socketId !== myIdRef.current) {
        // المنضم الجديد وحده يبدأ العرض. الطرف الموجود ينتظر العرض ويرد عليه،
        // وده يمنع glare الناتج عن إنشاء offer من الطرفين في نفس اللحظة.
        void ensurePeer(socketId);
      }
    };
    const onSpeaking = ({ from, speaking }: { from: string; speaking: boolean }) => {
      if (!joinedRef.current || !from) return;
      const next = new Set(speakingRef.current);
      if (speaking) next.add(from);
      else next.delete(from);
      speakingRef.current = next;
      setSpeakingIds([...next]);
    };

    net.on('voice:signal', onSignal);
    net.on('voice:ice', onIce);
    net.on('voice:peer-left', onPeerLeft);
    net.on('voice:peer-joined', onPeerJoined);
    net.on('voice:speaking', onSpeaking);
    return () => {
      net.off('voice:signal', onSignal);
      net.off('voice:ice', onIce);
      net.off('voice:peer-left', onPeerLeft);
      net.off('voice:peer-joined', onPeerJoined);
      net.off('voice:speaking', onSpeaking);
    };
  }, [ensurePeer, negotiatePeer, sendDescription, teardownPeer, updatePeerDebug]);

  useEffect(() => {
    if (!joined) return;
    const interval = window.setInterval(() => {
      for (const [peerId, pc] of pcsRef.current.entries()) {
        const stuck = pc.connectionState === 'new' || pc.iceConnectionState === 'new';
        if (!stuck || pc.signalingState !== 'stable') continue;
        updatePeerDebug(peerId, { lastError: 'voice watchdog: forcing negotiation/ICE restart' });
        if (pc.localDescription) {
          pc.restartIce();
          void negotiatePeer(peerId, { iceRestart: true });
        } else {
          void negotiatePeer(peerId);
        }
      }
    }, 3500);
    return () => window.clearInterval(interval);
  }, [joined, negotiatePeer, updatePeerDebug]);

  useEffect(() => {
    for (const [peerId, element] of audioElsRef.current.entries()) applyAudibility(peerId, element);
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = Boolean(policy?.canSpeak && micOnRef.current);
  }, [applyAudibility, policy, peerIds]);

  useEffect(() => {
    micOnRef.current = micOn;
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = Boolean(policy?.canSpeak && micOn);
  }, [micOn, policy]);

  useEffect(() => {
    const analysers = analysersRef.current;
    const audioCtx = audioCtxRef.current;
    return () => {
      void getRoomNet()?.request('voice:leave').catch(() => undefined);
      teardownAll(pcsRef, audioElsRef, remoteStreamsRef, streamRef, iceBuffersRef);
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
      if (audioCtx) void audioCtx.close().catch(() => undefined);
      audioCtxRef.current = null;
      joinedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!joined) return;
    const tick = () => {
      const next = new Set(speakingRef.current);
      let selfSpeaking = false;
      for (const [peerId, entry] of analysersRef.current.entries()) {
        entry.analyser.getByteTimeDomainData(entry.data);
        let peak = 0;
        for (let i = 0; i < entry.data.length; i += 1) peak = Math.max(peak, Math.abs(entry.data[i] - 128));
        const active = peak > 6;
        if (active) next.add(peerId);
        else next.delete(peerId);
        if (peerId === '__self__') selfSpeaking = active;
      }
      if (broadcastSpeakingRef.current !== selfSpeaking) {
        broadcastSpeakingRef.current = selfSpeaking;
        getRoomNet()?.sendVoice('voice:speaking', '*', { speaking: selfSpeaking });
      }
      const prev = speakingRef.current;
      const changed = prev.size !== next.size || [...next].some((id) => !prev.has(id));
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
    debug,
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
  remoteStreamsRef: React.RefObject<Map<string, MediaStream>>,
  streamRef: React.RefObject<MediaStream | null>,
  iceBuffersRef: React.RefObject<Map<string, RTCIceCandidateInit[]>>,
) {
  for (const pc of pcsRef.current?.values() ?? []) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.onsignalingstatechange = null;
    pc.onnegotiationneeded = null;
    pc.close();
  }
  pcsRef.current?.clear();
  for (const element of audioElsRef.current?.values() ?? []) {
    element.srcObject = null;
    element.remove();
  }
  audioElsRef.current?.clear();
  remoteStreamsRef.current?.clear();
  iceBuffersRef.current?.clear();
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}
