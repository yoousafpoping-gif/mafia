'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ServerError,
  createHostNet,
  createPeerNet,
  getRoomNet,
  setRoomNet,
} from '@/lib/net';
import { clearSeat, loadSeat, saveSeat } from '@/lib/seat';
import { localNotify } from '@/lib/pushNotifications';
import type {
  ActionRequest,
  ChatMessage,
  GameState,
  MayorRevealPayload,
  NightResultPayload,
  RevengePrompt,
  Role,
  VoicePolicy,
  VoteResultPayload,
} from '@/lib/types';

export interface ToastItem {
  id: number;
  code?: string;
  message: string;
}

export interface ConnectionStatus {
  connected: boolean;
  seated: boolean;
  joining: boolean;
}

interface UseMafiaGameOptions {
  code?: string;
}

export function useMafiaGame({ code }: UseMafiaGameOptions = {}) {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    const existing = getRoomNet();
    return {
      connected: Boolean(existing),
      seated: Boolean(existing),
      joining: Boolean(code) && !existing,
    };
  });
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [revengePrompt, setRevengePrompt] = useState<RevengePrompt | null>(null);
  const [roleCardOpen, setRoleCardOpen] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [nightResult, setNightResult] = useState<NightResultPayload | null>(null);
  const [voteResult, setVoteResult] = useState<VoteResultPayload | null>(null);
  const [voteProgress, setVoteProgress] = useState<{ cast: number; expected: number } | null>(null);
  const [mayorNotice, setMayorNotice] = useState<MayorRevealPayload | null>(null);
  const [voicePolicy, setVoicePolicy] = useState<VoicePolicy | null>(null);
  const [elimination, setElimination] = useState<GameState['elimination']>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  /** ريأكشنز نشطة فوق الكروت — {playerId, emojiId, at, key} */
  const [reactions, setReactions] = useState<
    { playerId: string; emojiId: string; at: number; key: number }[]
  >([]);
  /** الاتصال P2P الحالي — بيتبدل لما نعمل أوضة أو ندخل واحدة */
  const [net, setNet] = useState(() => getRoomNet());
  const reactionKey = useRef(0);
  const toastId = useRef(0);
  const seatRef = useRef(loadSeat(code ?? ''));

  const pushToast = useCallback((message: string, errorCode?: string) => {
    toastId.current += 1;
    const item: ToastItem = { id: toastId.current, message, code: errorCode };
    setToasts((prev) => [...prev.slice(-3), item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== item.id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applyState = useCallback((next: GameState | null | undefined) => {
    if (!next) return;
    setState(next);
    setStatus({ connected: true, seated: true, joining: false });
  }, []);

  // أي طلب رايح للهوست — هوست محلي أو بيير بعيد.
  const request = useCallback(async (event: string, payload?: unknown) => {
    const current = getRoomNet();
    if (!current) throw new ServerError({ code: 'NOT_CONNECTED', message: 'مفيش اتصال بالأوضة' });
    return current.request(event, payload);
  }, []);

  const sync = useCallback(async () => {
    try {
      const current = getRoomNet();
      if (!current) return;
      const data = (await current.request('game:sync')) as { state: GameState };
      applyState(data.state);
    } catch (error) {
      if (error instanceof ServerError && error.code === 'NOT_IN_ROOM') {
        setStatus((prev) => ({ ...prev, seated: false }));
      }
    }
  }, [applyState]);

  useEffect(() => {
    if (!net) return;

    const onRoomUpdate = (next: GameState) =>
      setState((prev) => ({ ...(prev ?? next), ...next, you: next.you ?? prev?.you }));

    const onPhaseChange = (payload: {
      phase: GameState['phase'];
      round: number;
      deadline: number | null;
      nightReport?: { victim: string | null; silenced: string | null } | null;
      elimination?: { playerId: string; name: string; role: Role } | null;
    }) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              phase: payload.phase,
              round: payload.round,
              deadline: payload.deadline,
              ...(payload.nightReport !== undefined ? { nightReport: payload.nightReport } : {}),
            }
          : prev,
      );
      setElimination(payload.elimination ?? null);
      setVoteProgress(null);
      setVoteResult(null);
      setNightResult(null);
      setMayorNotice(null);
      // التاب مخفي والنهار طلع؟ إشعار محلي احتياطي (لو مفيش اشتراك دفع حقيقي)
      if (payload.phase === 'DAY_DISCUSSION') {
        void localNotify('حارة المافيا — الصبح طلع!', 'النقاش بدأ — ارجع للأوضة بسرعة', `/game?code=${code ?? ''}`);
      }
      void sync();
    };

    const onActionRequest = (req: ActionRequest) => setActionRequest(req);

    const onActionAccepted = () => void sync();

    const onGameStarted = (next: GameState) => {
      applyState(next);
      setRoleCardOpen(true);
      setActionRequest(null);
      void localNotify('حارة المافيا — اللعبة بدأت!', 'الأدوار اتوزعت — افتح دورك بسرعة', `/game${next.code ? `/${next.code}` : ''}`);
    };

    const onNightResult = (payload: NightResultPayload) => setNightResult(payload);

    const onVoteProgress = (progress: { cast: number; expected: number }) =>
      setVoteProgress(progress);

    const onVoteResult = (payload: VoteResultPayload) => setVoteResult(payload);

    const onMayorRevealed = (payload: MayorRevealPayload) => {
      setMayorNotice(payload);
      setTimeout(() => setMayorNotice(null), 6000);
    };

    const onGoodBoyPrompt = (prompt: RevengePrompt) => setRevengePrompt(prompt);

    const onVoicePolicy = (policy: VoicePolicy) => setVoicePolicy(policy);

    const onChatMessage = (message: ChatMessage) =>
      setChat((prev) => [...prev.slice(-99), message]);

    const onReaction = (payload: { playerId: string; emojiId: string }) => {
      reactionKey.current += 1;
      const item = { ...payload, at: Date.now(), key: reactionKey.current };
      setReactions((prev) => [...prev.slice(-7), item]);
      // الريأكشن بيعيش 3 ثواني فوق الكارت وبعدين بيتمسح من الحالة
      window.setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.key !== item.key));
      }, 3000);
    };

    const onGameOver = () => {
      void sync();
    };

    const onRoomClosed = () => {
      pushToast('الأوضة اتقفلت خلاص.', 'ROOM_CLOSED');
      clearSeat(code ?? '');
      setState(null);
      setStatus({ connected: false, seated: false, joining: false });
    };

    const onErrorEvent = (payload: { code?: string; message?: string }) =>
      pushToast(payload.message ?? 'حركة غلط يا بطل', payload.code);

    net.on('room:update', onRoomUpdate);
    net.on('phase:change', onPhaseChange);
    net.on('action:request', onActionRequest);
    net.on('action:accepted', onActionAccepted);
    net.on('game:started', onGameStarted);
    net.on('game:night_result', onNightResult);
    net.on('vote:progress', onVoteProgress);
    net.on('game:vote_result', onVoteResult);
    net.on('game:mayor_revealed', onMayorRevealed);
    net.on('good_boy:prompt', onGoodBoyPrompt);
    net.on('voice:policy', onVoicePolicy);
    net.on('chat:message', onChatMessage);
    net.on('reaction:show', onReaction);
    net.on('game:over', onGameOver);
    net.on('room:closed', onRoomClosed);
    net.on('action:error', onErrorEvent);

    return () => {
      net.off('room:update', onRoomUpdate);
      net.off('phase:change', onPhaseChange);
      net.off('action:request', onActionRequest);
      net.off('action:accepted', onActionAccepted);
      net.off('game:started', onGameStarted);
      net.off('game:night_result', onNightResult);
      net.off('vote:progress', onVoteProgress);
      net.off('game:vote_result', onVoteResult);
      net.off('game:mayor_revealed', onMayorRevealed);
      net.off('good_boy:prompt', onGoodBoyPrompt);
      net.off('chat:message', onChatMessage);
      net.off('reaction:show', onReaction);
      net.off('game:over', onGameOver);
      net.off('room:closed', onRoomClosed);
      net.off('action:error', onErrorEvent);
    };
  }, [net, applyState, code, pushToast, sync]);

  // صفحة الأوضة: لو مفيش اتصال جاهز جرّب يعيد الربط بالتوكن المحفوظ.
  useEffect(() => {
    if (!code || net) return;

    let cancelled = false;
    const attempt = async () => {
      const seat = loadSeat(code);
      if (seat?.token) {
        seatRef.current = seat;
        try {
          const created = await createPeerNet(code, seat.name ?? '', seat.token);
          if (cancelled) return;
          setRoomNet(created);
          setNet(created);
          applyState(await created.sync());
          return;
        } catch {
          /* التوكن قديم — هيدخل يدوي */
        }
      }
      if (!cancelled) setStatus({ connected: false, seated: false, joining: false });
    };

    void attempt();
    return () => {
      cancelled = true;
    };
  }, [code, net, applyState]);

  // الهوست بيتنقل من الرئيسية لصفحة الأوضة والاتصال معاه — لازم تعبئة الحالة
  // فورًا بالـ sync بدل شاشة "ادخل الأوضة" اللي بتهدم اتصال الهوست نفسه.
  useEffect(() => {
    if (!net) return;
    void sync();
  }, [net, sync]);

  const teardownCurrentNet = useCallback(() => {
    const current = getRoomNet();
    if (current) {
      try {
        current.destroy();
      } catch {
        /* already dead */
      }
    }
    setRoomNet(null);
    setNet(null);
  }, []);

  // صاحب الأوضة بيبقى الهوست تلقائيًا — البير بتاعه ID بتاعه = كود الأوضة.
  const openHostedRoom = useCallback(
    async (name: string): Promise<string> => {
      teardownCurrentNet();
      try {
        const created = await createHostNet(name);
        setNet(created);
        const fresh = await created.sync();
        const you = fresh.you as (typeof fresh)['you'] & { token?: string } | undefined;
        saveSeat({
          code: created.code,
          playerId: you?.id ?? '',
          token: you?.token ?? '',
          name: you?.name ?? name,
        });
        applyState(fresh);
        return created.code;
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'مقدرناش نفتح الأوضة', serverError?.code);
        throw error;
      }
    },
    [applyState, pushToast, teardownCurrentNet],
  );

  const createRoom = openHostedRoom;

  // مفيش سيرفر ماتش ميكر — البحث السريع بيفتحلك أوضة إنت الهوست فيها.
  const quickMatch = openHostedRoom;

  const joinRoom = useCallback(
    async (rawCode: string, name: string): Promise<string> => {
      const targetCode = rawCode.trim().toUpperCase();
      const cleanName = name.trim();
      const existing = loadSeat(targetCode);
      const sameIdentity =
        existing?.name && existing.name.toLowerCase() === cleanName.toLowerCase();

      teardownCurrentNet();
      try {
        const created = await createPeerNet(
          targetCode,
          cleanName,
          sameIdentity ? existing?.token : undefined,
        );
        setNet(created);
        applyState(await created.sync());
        return created.code;
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        if (sameIdentity && serverError) {
          clearSeat(targetCode);
        }
        pushToast(serverError?.message ?? 'مقدرناش ندخل الأوضة', serverError?.code);
        throw error;
      }
    },
    [applyState, pushToast, teardownCurrentNet],
  );

  const startGame = useCallback(async () => {
    try {
      await request('game:start');
      await sync();
    } catch (error) {
      const serverError = error instanceof ServerError ? error : null;
      pushToast(serverError?.message ?? 'مقدرناش نبدأ اللعبة', serverError?.code);
    }
  }, [pushToast, request, sync]);

  const voteRematch = useCallback(
    async (ready = true) => {
      try {
        await request('room:rematch_vote', { ready });
        await sync();
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'صوتك ما اتسجلش', serverError?.code);
      }
    },
    [pushToast, request, sync],
  );

  // شاشة النصر — reset كامل للأوضة من غير قطع اتصال.
  const requestPlayAgain = useCallback(async () => {
    try {
      await request('game:request_play_again');
      await sync();
    } catch (error) {
      const serverError = error instanceof ServerError ? error : null;
      pushToast(serverError?.message ?? 'مقدرناش نعيد اللعبة', serverError?.code);
    }
  }, [pushToast, request, sync]);

  const addBot = useCallback(
    async (count = 1) => {
      try {
        await request('game:add_bot', { count });
        await sync();
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'البوت رفض ينزل معانا 😅', serverError?.code);
      }
    },
    [pushToast, request, sync],
  );

  const submitNightAbility = useCallback(
    async (targetId: string | null) => {
      try {
        await request('action:night_ability', { targetId });
        setActionRequest(null);
        await sync();
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'حركتك اترفضت', serverError?.code);
      }
    },
    [pushToast, request, sync],
  );

  const submitRevenge = useCallback(
    async (targetId: string | null) => {
      try {
        await request('action:good_boy_revenge', { targetId });
        setRevengePrompt(null);
        await sync();
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'الانتقام اترفض', serverError?.code);
      }
    },
    [pushToast, request, sync],
  );

  const revealMayor = useCallback(async () => {
    try {
      await request('action:mayor_reveal');
      await sync();
    } catch (error) {
      const serverError = error instanceof ServerError ? error : null;
      pushToast(serverError?.message ?? 'الكشف اترفض', serverError?.code);
    }
  }, [pushToast, request, sync]);

  const castVote = useCallback(
    async (targetId: string) => {
      try {
        await request('action:vote', { targetId });
        await sync();
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'الصوت اترفض', serverError?.code);
      }
    },
    [pushToast, request, sync],
  );

  const sendChat = useCallback(
    async (text: string) => {
      try {
        await request('chat:message', { text });
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'الرسالة اترفضت', serverError?.code);
      }
    },
    [pushToast, request],
  );

  // ريأكشن إيموجي — بث لكل الأوضة فوق كارتك
  const sendReaction = useCallback(
    async (emojiId: string) => {
      try {
        await request('reaction:send', { emojiId });
      } catch (error) {
        const serverError = error instanceof ServerError ? error : null;
        pushToast(serverError?.message ?? 'الريأكشن معاز', serverError?.code);
      }
    },
    [pushToast, request],
  );

  const leaveRoom = useCallback(() => {
    // وداع صريح قبل تفكيك الاتصال (RoomClient/RoomHost بيعملوا كده برضه في destroy)
    const current = getRoomNet();
    try {
      void current?.request('room:leave').catch(() => undefined);
    } catch {
      /* already dead — nothing to tell */
    }
    if (code) clearSeat(code);
    seatRef.current = null;
    teardownCurrentNet();

    // Complete local purge — no stale room state can ever render again.
    setState(null);
    setActionRequest(null);
    setRevengePrompt(null);
    setRoleCardOpen(false);
    setChat([]);
    setNightResult(null);
    setVoteResult(null);
    setVoteProgress(null);
    setMayorNotice(null);
    setVoicePolicy(null);
    setToasts([]);
    setStatus({ connected: false, seated: false, joining: false });
  }, [code, teardownCurrentNet]);

  return {
    state,
    status,
    actionRequest,
    revengePrompt,
    roleCardOpen,
    dismissRoleCard: () => setRoleCardOpen(false),
    clearElimination: () => setElimination(null),
    elimination,
    chat,
    reactions,
    nightResult,
    voteResult,
    voteProgress,
    mayorNotice,
    voicePolicy,
    toasts,
    dismissToast,
    createRoom,
    joinRoom,
    quickMatch,
    startGame,
    voteRematch,
    requestPlayAgain,
    addBot,
    submitNightAbility,
    submitRevenge,
    revealMayor,
    castVote,
    sendChat,
    sendReaction,
    leaveRoom,
    sync,
  };
}
