'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, UserX } from 'lucide-react';
import { useMafiaGame } from '@/hooks/useMafiaGame';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuth } from '@/context/AuthContext';
import { playSound, playNarrator, stopNarrator } from '@/lib/audioManager';
import { SERVER_URL } from '@/lib/config';
import { ROLE_META } from '@/lib/roles';
import { playSfx, initGlobalSfx, startAmbientRain, stopAmbientRain, startNightAmbient, stopNightAmbient } from '@/lib/sfx';
import { recordGameResult } from '@/lib/stats';
import { loadSeat } from '@/lib/seat';
import { localNotify, syncRoomPushBinding } from '@/lib/pushNotifications';
import { ChatDock } from './ChatDock';
import { CouncilTable } from './CouncilTable';
import { ExecutionOverlay } from './ExecutionOverlay';
import { GameLogPanel } from './GameLogPanel';
import { GameOverScreen } from './GameOverScreen';
import { HelpModal } from './HelpModal';
import { LobbyView } from './LobbyView';
import { MorningReport } from './MorningReport';
import { NewsFlashModal } from './NewsFlashModal';
import { NewspaperModal, NEWSPAPER_MS } from './NewspaperModal';
import { NightOverlay } from './NightOverlay';
import { PhaseTransition } from './PhaseTransition';
import { RevengeModal } from './RevengeModal';
import { RoleRevealModal } from './RoleRevealModal';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { VictoryModal } from './VictoryModal';
import { VotingPanel } from './VotingPanel';

export function GameClient({ code }: { code: string }) {
  const router = useRouter();
  const game = useMafiaGame({ code });
  const { state, status } = game;
  const voice = useVoiceChat(state ?? null, game.voicePolicy);
  const [helpOpen, setHelpOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const phase = state?.phase;
  const round = state?.round;

  // الخروج النظيف: purge كامل ثم رجوع فوري للرئيسية —
  // الكومبوننت يتفك قبل ما أي شاشة تحميل تلحق تظهر.
  const handleLeave = () => {
    if (voice.joined) voice.leave();
    game.leaveRoom();
    router.replace('/');
  };

  useEffect(() => {
    initGlobalSfx();
  }, []);

  // جريدة الصبح — تريجر صارم على [phase, round] بس (مش state اللي بيتغير كل ثانية).
  // مفيش ref guard عشان StrictMode/mounts مبتكسرهاش — الجولة الجديدة = ظهور جديد.
  const [showNewspaper, setShowNewspaper] = useState(false);
  // جريدة الخبر العاجل — بتفتح بعد مشهد الإعدام على نفس الـelimination
  const [newsFlashOpen, setNewsFlashOpen] = useState(false);
  // بالونات الكلام — آخر رسالة لكل لاعب فوق كارته (بتقفل بعد 3.5 ثانية)
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const bubbleTimersRef = useRef<Map<string, number>>(new Map());
  // آخر نسخة من تقرير الليل من غير ما ندخله في deps (فوق ميعيد التريجر).
  const nightReportRef = useRef(state?.nightReport ?? null);
  useEffect(() => {
    nightReportRef.current = state?.nightReport ?? null;
  }, [state]);

  // تتبع آخر رسالة شات لكل لاعب — البالونة تظهر فوق كارته وتموت بعد 3.5 ثانية
  const lastChatMsg = game.chat[game.chat.length - 1];
  useEffect(() => {
    if (!lastChatMsg) return undefined;
    const pid = lastChatMsg.from.id;
    // setState جوه إفكت لازم يتأجل (قاعدة react-hooks/set-state-in-effect)
    const defer = window.setTimeout(() => {
      setBubbles((prev) => ({ ...prev, [pid]: lastChatMsg.text }));
      const prevTimer = bubbleTimersRef.current.get(pid);
      if (prevTimer !== undefined) window.clearTimeout(prevTimer);
      const timer = window.setTimeout(() => {
        setBubbles((prev) => {
          const next = { ...prev };
          delete next[pid];
          return next;
        });
        bubbleTimersRef.current.delete(pid);
      }, 3500);
      bubbleTimersRef.current.set(pid, timer);
    }, 0);
    return () => window.clearTimeout(defer);
  }, [lastChatMsg]);
  useEffect(
    () => () => {
      for (const timer of bubbleTimersRef.current.values()) window.clearTimeout(timer);
      bubbleTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (phase === 'DAY_DISCUSSION' && (round ?? 0) > 0) {
      let shot: number | undefined;
      const show = window.setTimeout(() => {
        setShowNewspaper(true);
        // طلقة المافيا — أول ما الجورنال ينزل وفيه ضحية (على إعدادات الصوت العامة).
        if (nightReportRef.current?.victim) {
          shot = window.setTimeout(() => playSound('/assets/sounds/gunshot.mp3', 0.9), 500);
        }
      }, 0);
      const hide = window.setTimeout(() => setShowNewspaper(false), NEWSPAPER_MS);
      return () => {
        window.clearTimeout(show);
        window.clearTimeout(hide);
        if (shot !== undefined) window.clearTimeout(shot);
      };
    } else {
      const off = window.setTimeout(() => setShowNewspaper(false), 0);
      return () => window.clearTimeout(off);
    }
  }, [phase, round]);

  // Ambient rain bed — starts with the first real phase, stops on unmount.
  const ambientStarted = useRef(false);
  useEffect(() => {
    if (!phase || phase === 'LOBBY' || ambientStarted.current) return;
    ambientStarted.current = true;
    startAmbientRain();
  }, [phase]);
  useEffect(() => () => stopAmbientRain(), []);

  // Night atmosphere — ambience loop only at night, killed at daybreak.
  useEffect(() => {
    if (phase === 'NIGHT') startNightAmbient();
    else stopNightAmbient();
    return () => stopNightAmbient();
  }, [phase]);

  // Local progression stats — recorded exactly once per finished game.
  // مع حساب جوجل: النتيجة بترتفع كمان لبروفايل السيرفر (صدارة + كوينز).
  const { user: authUser, refreshProfile } = useAuth();
  const recordedRef = useRef('');
  useEffect(() => {
    const result = state?.result;
    if (!result || !state || state.phase !== 'GAME_OVER' || !state.you) return;
    const key = `${state.code}:${result.winner}:${result.reason}`;
    if (recordedRef.current === key) return;
    recordedRef.current = key;
    const you = state.you;
    const roster = result.roster;
    const applied = recordGameResult(
      you.id,
      result.winner,
      roster.map((entry) => ({ id: entry.id, role: entry.role, isAlive: entry.isAlive })),
    );
    if (!applied || !authUser) return;
    const youSeat = roster.find((entry) => entry.id === you.id);
    const yourTeam = youSeat?.role ? ROLE_META[youSeat.role]?.team : null;
    const won = yourTeam
      ? yourTeam === 'NEUTRAL'
        ? result.winner === 'NEUTRAL'
        : result.winner === yourTeam
      : false;
    fetch(`${SERVER_URL}/api/profile/${authUser.uid}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ won }),
    })
      .then(() => refreshProfile())
      .catch(() => {
        /* السيرفر مش متصل — النتيجة المحلية اتحفظت خلاص */
      });
  }, [state, authUser, refreshProfile]);

  useEffect(() => {
    if (!phase) return;
    if (phase === 'NIGHT') playSfx('night');
    else if (phase === 'DAY_DISCUSSION' || phase === 'DAY_VOTING') playSfx('day');
  }, [phase, round]);

  // صوت الراوي — خط واحد في كل لحظة: أي سطر جديد بيوقف اللي قبله.
  const NARRATOR_BY_PHASE: Partial<Record<NonNullable<typeof phase>, string>> = {
    NIGHT: '/assets/sounds/narrator_night.mp3',
    DAY_DISCUSSION: '/assets/sounds/narrator_day.mp3',
    DAY_VOTING: '/assets/sounds/narrator_vote.mp3',
  };
  useEffect(() => {
    if (!phase) return;
    const line = NARRATOR_BY_PHASE[phase];
    if (line) playNarrator(line, 1.0);
    else stopNarrator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // سطر فوز الراوي — شاشة النصر (VictoryModal) بتشغّله دلوقتي بمجرد ما
  // تنزل، فمش محتاجين إفكت مكرر هنا (كان هيشغّل الخط مرتين ورا بعض).

  const practiceConsumed = useRef(false);
  const lobbyPhase = state?.phase;
  const hostFlag = state?.you?.isHost ?? false;
  useEffect(() => {
    if (practiceConsumed.current) return;
    if (lobbyPhase !== 'LOBBY' || !hostFlag) return;
    const flag = sessionStorage.getItem('mafia-practice');
    if (!flag) return;
    practiceConsumed.current = true;
    sessionStorage.removeItem('mafia-practice');
    void game.addBot(Number(flag) || 5);
  }, [lobbyPhase, hostFlag, game]);

  // ربط إشعارات الدفع بمعرّف القعدة — السيرفر بيستخدمه لإشعارات المراحل
  const roomPlayerId = state?.you?.id;
  useEffect(() => {
    if (roomPlayerId && authUser) {
      void syncRoomPushBinding(roomPlayerId, authUser.displayName);
    }
  }, [roomPlayerId, authUser]);

  if (!state || !state.you) {
    return (
      <NoSeatScreen
        code={code}
        joining={status.joining}
        onJoin={game.joinRoom}
        onInviteSeen={() => {
          if (window.location.search.includes('invite=')) {
            void localNotify(
              'وصلتك دعوة من حارة المافيا! 🎩',
              `صاحبك بعثلك دعوة للأوضة ${code} — اكتب اسمك وادخل`,
              `/game?code=${code}`,
              { force: true },
            );
          }
        }}
        toasts={game.toasts}
        onDismissToast={game.dismissToast}
      />
    );
  }

  const you = state.you;
  const isDay =
    state.phase === 'DAY_DISCUSSION' || state.phase === 'DAY_VOTING' || state.phase === 'DEFENSE_STAGE';
  const lastWordsActive = state.phase === 'LAST_WORDS';
  const defenseActive = state.phase === 'DEFENSE_STAGE';
  const inGame = isDay || lastWordsActive || state.phase === 'NIGHT';
  const mySid = state.players.find((player) => player.id === you.id)?.sid ?? null;
  const tableSpeakingIds = voice.speakingIds
    .map((id) => (id === '__self__' ? mySid : id))
    .filter((id): id is string => Boolean(id));
  const lastWordsMine = state.lastWords?.playerId === you.id;
  const defendingMe = defenseActive && state.defense?.playerId === you.id;
  // قناة المافيا السرية — ليلًا وأنت حي من العيلة
  const nightFamilyChannel =
    state.phase === 'NIGHT' && you.isAlive && you.team === 'MAFIA';

  return (
    // Full-bleed: الشاشة كلها هي أوضة اللعبة — الصورة على الروت مباشرة.
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[url('/assets/backgrounds/table_bg.jpeg')] bg-cover bg-center bg-no-repeat">
      {/* Night falls: the whole room photo crushes to 35% brightness */}
      <div
        className={`pointer-events-none absolute inset-0 z-0 bg-black/40 transition-[filter] duration-1000 ${
          phase === 'NIGHT' ? 'night-dim' : ''
        }`}
      />
      {/* Flickering light on night entry (2s, opacity jumps .3 → .9) */}
      {phase === 'NIGHT' && (
        <span aria-hidden className="lighting-flicker pointer-events-none absolute inset-0 z-[5] bg-black" />
      )}

      <div className="relative z-10 flex h-full w-full flex-col">
      <TopBar
        state={state}
        connected={status.connected}
        voice={voice}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenLog={() => setLogOpen(true)}
        onLeave={handleLeave}
      />

      {state.phase !== 'LOBBY' && (
        <PhaseTransition key={`${state.phase}-${state.round}`} phase={state.phase} round={state.round} />
      )}

      {state.phase === 'LOBBY' && (
        <main className="noir-vignette flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-xl px-4 py-5">
            <LobbyView
              state={state}
              onStart={game.startGame}
              onAddBot={(count) => void game.addBot(count)}
            />
          </div>
        </main>
      )}

      {(inGame || state.phase === 'GAME_OVER') && (
        <>
          {/* جريدة اليوم السابع — التريجر في الـ effect فوق على [phase, round] */}
          {showNewspaper && state.phase === 'DAY_DISCUSSION' && (
            <NewspaperModal
              report={state.nightReport ?? null}
              round={state.round}
            />
          )}
          <main className="relative min-h-0 flex-1">
            {/* pt/pb أمان: مسافة فوق للهيدر وتحت لدوك الشات عشان الكروت ما تقصّش */}
            <div className="absolute inset-0 px-4 pb-28 pt-16 sm:px-4">
              {state.phase !== 'GAME_OVER' ? (
                <CouncilTable
                      state={state}
                      onRevealMayor={game.revealMayor}
                      speakingIds={tableSpeakingIds}
                      recentMessages={bubbles}
                      reactions={game.reactions}
                    />
              ) : (
                state.result && (
                  <div className="mx-auto h-full max-w-3xl overflow-y-auto">
                    <GameOverScreen
                      result={state.result}
                      youId={you.id}
                      isHost={you.isHost}
                      players={state.players}
                      rematchVotes={state.rematchVotes ?? []}
                      onVoteRematch={game.voteRematch}
                      onPlayAgain={game.startGame}
                      onLeave={handleLeave}
                    />
                  </div>
                )
              )}
            </div>

            {/* floating HUD cards over the table */}
            {state.phase === 'DAY_DISCUSSION' && game.nightResult && (
              <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-2">
                <div className="pointer-events-auto w-[min(94%,440px)]">
                  <MorningReport nightResult={game.nightResult} round={state.round} />
                </div>
              </div>
            )}
            {(state.phase === 'DAY_VOTING' || state.phase === 'DEFENSE_STAGE') && (
              <div className="absolute bottom-2 start-2 z-30 max-h-[72%] w-[min(93%,360px)] overflow-y-auto rounded-2xl shadow-2xl">
                <VotingPanel
                  state={state}
                  voteProgress={game.voteProgress}
                  voteResult={game.voteResult}
                  onVote={game.castVote}
                />
              </div>
            )}
          </main>

          <ChatDock
            messages={game.chat}
            youId={you.id}
            canSend={Boolean(
              (you.isAlive && !you.isSilenced && isDay) ||
                (lastWordsActive && lastWordsMine) ||
                defendingMe ||
                nightFamilyChannel,
            )}
            channelNote={
              nightFamilyChannel ? 'قناة المافيا السرية (خاصة بفرقتك)' : null
            }
            disabledReason={
              !you.isAlive
                ? 'الأموات ما لهمش صوت في مجلس الأحياء'
                : you.isSilenced && !lastWordsActive
                  ? 'السّكّاتير سدّ بوقك'
                  : lastWordsActive && !lastWordsMine
                    ? 'المتهم بينطق كلماته الأخيرة.. اسمعه بس'
                    : defenseActive && !defendingMe
                      ? 'المتهم بيدافع.. غيّر صوتك من لوحة التصويت!'
                      : undefined
            }
            onSend={game.sendChat}
            onReaction={(emojiId) => void game.sendReaction(emojiId)}
          />
        </>
      )}

      {state.phase === 'NIGHT' && (
        <NightOverlay
          state={state}
          actionRequest={game.actionRequest}
          voicePolicy={game.voicePolicy}
          onSubmitAbility={game.submitNightAbility}
        />
      )}

      {/* مشهد الإعدام السينمائي ثم جريدة الخبر العاجل — متسلسلين على نفس الـpayload */}
      {game.elimination && !newsFlashOpen ? (
        <ExecutionOverlay elimination={game.elimination} onClose={() => setNewsFlashOpen(true)} />
      ) : null}
      <NewsFlashModal
        open={newsFlashOpen}
        elimination={game.elimination}
        onClose={() => {
          setNewsFlashOpen(false);
          game.clearElimination();
        }}
      />

      <RoleRevealModal
        open={game.roleCardOpen && state.phase !== 'LOBBY'}
        onClose={game.dismissRoleCard}
        you={you}
        phase={state.phase}
        round={state.round}
        aliveCount={state.players.filter((p) => p.isAlive).length}
      />

      <RevengeModal
        prompt={game.revengePrompt}
        deadline={state.deadline}
        onSubmit={game.submitRevenge}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <GameLogPanel state={state} open={logOpen} onClose={() => setLogOpen(false)} />

      {/* إعلان النهاية السينمائي — فوق كل حاجة، وجميع الشاشات تحت الرؤية منه */}
      {state.phase === 'GAME_OVER' && state.result && (
        <VictoryModal
          state={state}
          youId={you.id}
          onPlayAgain={() => void game.requestPlayAgain()}
          onLeave={handleLeave}
        />
      )}

      <Toasts toasts={game.toasts} onDismiss={game.dismissToast} />
      </div>
    </div>
  );
}

/**
 * شاشة الوصول لأوضة من غير قعدة — بنفتح أوضة، أو بيهنيك على لينك دعوة.
 * لو الأوضة لسه موجودة فيه اسم + دخول مباشر (deep-join من لينك الدعوة).
 */
function NoSeatScreen({
  code,
  joining,
  onJoin,
  onInviteSeen,
  toasts,
  onDismissToast,
}: {
  code: string;
  joining: boolean;
  onJoin: (rawCode: string, name: string) => Promise<string>;
  onInviteSeen: () => void;
  toasts: { id: number; code?: string; message: string }[];
  onDismissToast: (id: number) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const inviteSeenRef = useRef(false);

  useEffect(() => {
    // اسمك القديم في الأوضة دي (لو لعبت قبل كده) — مؤجّل عشان setState
    // مباشر جوه الإفكت بيعمل cascading renders
    const hydrate = window.setTimeout(() => {
      const saved = loadSeat(code);
      if (saved?.name) setName(saved.name);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, [code]);

  // إشعار الدعوة — أول ما الشاشة تنزل من لينك فيه ?invite=
  useEffect(() => {
    if (inviteSeenRef.current) return;
    inviteSeenRef.current = true;
    onInviteSeen();
  }, [onInviteSeen]);

  const handleJoin = async () => {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      await onJoin(code, name.trim());
    } catch {
      setBusy(false);
    }
  };

  return (
    <main className="fixed inset-0 flex w-full items-center justify-center overflow-hidden bg-[url('/assets/backgrounds/table_bg.jpeg')] bg-cover bg-center bg-no-repeat px-4">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-night-600/60 bg-black/60 p-8 text-center backdrop-blur-md">
        {/* سبينر بس وقت إعادة الربط التلقائية — بعدها فورم الدخول اليدوي
            لازم يظهر حتى لو الاتصال فاشل (لينك دعوة من غير قعدة محفوظة) */}
        {joining ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-400" strokeWidth={1.5} />
            <p className="mt-4 text-sm text-slate-400">
              بنفتح أوضة <span className="font-mono text-gold-300">{code}</span>...
            </p>
          </>
        ) : (
          <>
            <UserX className="mx-auto h-8 w-8 text-blood-400" strokeWidth={1.5} />
            <p className="mt-4 text-sm text-slate-400">
              وصلت أوضة <span className="font-mono text-gold-300">{code}</span> — اكتب اسمك وادخل.
            </p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleJoin()}
              maxLength={16}
              placeholder="اسمك يا بطل..."
              className="mt-5 w-full rounded-lg border border-night-600 bg-night-900/90 px-3 py-2.5 text-center text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20"
            />
            <button
              onClick={() => void handleJoin()}
              disabled={name.trim().length < 2 || busy}
              className="mt-3 w-full rounded-lg border border-gold-500/50 bg-gold-500/15 px-5 py-2.5 text-sm font-bold text-gold-300 transition enabled:hover:bg-gold-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'بنجهّز قعدتك...' : 'ادخل الأوضة'}
            </button>
            <Link
              href="/"
              className="mt-4 inline-block text-xs text-slate-500 transition hover:text-slate-300"
            >
              ارجع للأوضة الرئيسية
            </Link>
          </>
        )}
      </div>
      <Toasts toasts={toasts} onDismiss={onDismissToast} />
    </main>
  );
}
