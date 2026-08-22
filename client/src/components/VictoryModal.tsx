'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, LogOut, RotateCcw, Skull, Target, Timer, Users } from 'lucide-react';
import { RoleAvatar } from './Avatars';
import { playNarrator, stopNarrator } from '@/lib/audioManager';
import { GAME_LOGO, GAME_TITLE } from '@/lib/branding';
import { ROLE_META } from '@/lib/roles';
import type { GameState, Team } from '@/lib/types';

/** ثلاثة مسارات بصرية — مدينة منتصرة / مافيا مسيطرة / فخ الجوكر الصوفي */
const THEMES: Record<
  Team,
  {
    banner: string;
    sub: string;
    headerClass: string;
    frameClass: string;
    glowClass: string;
    chipClass: string;
    confetti: boolean;
    narrator: string | null;
  }
> = {
  TOWN: {
    banner: 'انتصرت المدينة وتطهرت من المافيا!',
    sub: 'العدالة نزلت في الشوارع.. والمافيا راحت في غير رجعة',
    headerClass:
      'text-glow-gold font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-300 to-amber-600 drop-shadow-[0_0_30px_rgba(229,181,103,0.55)]',
    frameClass: 'border-gold-500/50 shadow-[0_0_90px_rgba(229,181,103,0.28)]',
    glowClass: 'bg-[radial-gradient(ellipse_at_center,_rgba(229,181,103,0.16),_transparent_65%),radial-gradient(ellipse_at_20%_0%,_rgba(96,165,250,0.10),_transparent_55%)]',
    chipClass: 'border-sky-400/50 bg-sky-500/10 text-sky-200',
    confetti: true,
    narrator: '/assets/sounds/narrator_citizens_win.mp3',
  },
  MAFIA: {
    banner: 'سقطت المدينة في أيدي المافيا!',
    sub: 'الشوارع بقت ملكهم.. والعدالة اتنست في الزحمة',
    headerClass:
      'font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-red-200 via-blood-400 to-blood-700 drop-shadow-[0_0_26px_rgba(220,38,38,0.5)] [text-shadow:0_2px_4px_rgba(0,0,0,0.9)]',
    frameClass: 'border-blood-600/60 shadow-[0_0_90px_rgba(220,38,38,0.3)]',
    glowClass: 'bg-[radial-gradient(ellipse_at_center,_rgba(185,28,28,0.16),_transparent_65%)]',
    chipClass: 'border-blood-500/50 bg-blood-700/15 text-blood-200',
    confetti: false,
    narrator: '/assets/sounds/narrator_mafia_win.mp3',
  },
  NEUTRAL: {
    banner: 'سقط الجميع في فخ الجوكر!',
    sub: 'ولا المافيا كسبت.. ولا المدينة نجو — الكل كان بيتلعب',
    headerClass:
      'font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-200 via-purple-400 to-purple-700 drop-shadow-[0_0_30px_rgba(192,132,252,0.5)]',
    frameClass: 'border-purple-500/50 shadow-[0_0_90px_rgba(168,85,247,0.3)]',
    glowClass: 'bg-[radial-gradient(ellipse_at_center,_rgba(147,51,234,0.15),_transparent_65%)]',
    chipClass: 'border-purple-400/50 bg-purple-600/15 text-purple-200',
    confetti: false,
    narrator: null,
  },
};

const CONFETTI_COLORS = ['#e5b567', '#fde68a', '#7dd3fc', '#f8fafc', '#d4af37'];

/** عشوائية حتمية نقية (xorshift) — تشتت بصري من غير Math.random في الـ render */
function pseudoRandom(seed: number): number {
  let x = (Math.imul(seed + 1, 2654435761) >>> 0) || 0x9e3779b9;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x / 4294967296;
}

/** شتات احتفالي خفيف — قطع CSS بس، من غير أي مكتبة جديدة */
function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        left: pseudoRandom(i * 7 + 1) * 100,
        delay: pseudoRandom(i * 7 + 2) * 2.4,
        duration: 2.8 + pseudoRandom(i * 7 + 3) * 2.4,
        size: 5 + pseudoRandom(i * 7 + 4) * 7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: (pseudoRandom(i * 7 + 5) - 0.5) * 160,
        round: pseudoRandom(i * 7 + 6) > 0.6,
      })),
    [],
  );
  if (!active) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-8vh', x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: '108vh', x: p.drift, rotate: 540 + p.id * 17, opacity: [0, 1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            backgroundColor: p.color,
            borderRadius: p.round ? '9999px' : '2px',
          }}
        />
      ))}
    </div>
  );
}

export function VictoryModal({
  state,
  youId,
  onPlayAgain,
  onLeave,
}: {
  state: GameState;
  youId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}) {
  const result = state.result;
  const theme = result ? (THEMES[result.winner] ?? THEMES.TOWN) : THEMES.TOWN;

  /* صوت الراوي — مرة واحدة أول ما الشاشة تنزل، وبيتقفل لوحده */
  useEffect(() => {
    if (theme.narrator) playNarrator(theme.narrator, 1.0);
    return () => stopNarrator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* MVP: ناجٍ من الفريق الفائز — والبني آدمين لهم الأولوية على البوتات */
  const winners = useMemo(
    () =>
      result
        ? result.roster.filter((seat) => {
            const meta = seat.role ? ROLE_META[seat.role] : null;
            return meta?.team === result.winner;
          })
        : [],
    [result],
  );
  const mvp = useMemo(() => {
    const alive = winners.filter((seat) => seat.isAlive);
    const pool = alive.length > 0 ? alive : winners;
    return (
      pool.find((seat) => seat.id === youId) ??
      pool.find((seat) => {
        const live = state.players.find((p) => p.id === seat.id);
        return live ? !live.isBot : true;
      }) ??
      pool[0] ??
      null
    );
  }, [winners, state.players, youId]);

  /* إحصائيات الماتش */
  const survivors = winners.filter((seat) => seat.isAlive);
  const mostTargeted = useMemo(() => {
    const tally = state.voteTally ?? {};
    let bestId: string | null = null;
    let bestCount = 0;
    for (const [id, count] of Object.entries(tally)) {
      if (count > bestCount) {
        bestCount = count;
        bestId = id;
      }
    }
    const seat = bestId ? result?.roster.find((r) => r.id === bestId) : null;
    return seat ? { name: seat.name, count: bestCount } : null;
  }, [state.voteTally, result]);

  /* حالة الريفانش — بتظهر في جلسات الأونلاين بس */
  const connected = state.players.filter((p) => p.isConnected);
  const readyCount = state.rematchVotes
    ? state.rematchVotes.filter((id) => connected.some((p) => p.id === id)).length
    : 0;
  const readyTotal = Math.max(connected.length, 1);
  const youVoted = Boolean(state.rematchVotes?.includes(youId));
  const waitingForOthers = youVoted && readyCount < connected.length && connected.length > 1;

  if (!result) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={theme.banner}
      className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden bg-black/90 backdrop-blur-md ${theme.glowClass}`}
    >
      <Confetti active={theme.confetti} />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 130, damping: 16 }}
        className={`relative mx-4 w-full max-w-2xl rounded-3xl border bg-gradient-to-b from-white/[0.05] to-transparent p-6 text-center sm:p-8 ${theme.frameClass}`}
      >
        {/* winner banner */}
        <motion.span
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2.6 }}
          className={`pointer-events-none absolute -inset-px rounded-3xl ${theme.glowClass}`}
        />
        {/* شعار حارة المافيا — فوق إعلان النتيجة */}
        <motion.img
          src={GAME_LOGO}
          alt={GAME_TITLE}
          initial={{ scale: 0.6, opacity: 0, y: -14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="mx-auto mb-2 h-20 w-20 object-contain drop-shadow-[0_0_22px_rgba(212,175,55,0.65)] sm:h-24 sm:w-24"
        />
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-bold tracking-[0.25em] uppercase ${theme.chipClass}`}
        >
          <Skull className="h-3 w-3" />
          {state.round > 0 ? `round ${state.round}` : 'finale'} · انتهت الجلسة
        </span>
        <h2 className={`mt-3 text-3xl leading-tight sm:text-4xl ${theme.headerClass}`}>
          {theme.banner}
        </h2>
        <p className="mt-2 text-xs text-slate-400 sm:text-sm">{result.reason ?? theme.sub}</p>

        {/* MVP badge */}
        {mvp && mvp.role && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 200, damping: 12 }}
            className="relative mx-auto mt-5 w-fit"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-3 animate-pulse rounded-full bg-[radial-gradient(circle,_rgba(229,181,103,0.35),_transparent_70%)] blur-lg"
            />
            <div className="relative flex flex-col items-center rounded-2xl border border-gold-400/60 bg-gradient-to-b from-gold-500/15 to-transparent px-6 py-4 shadow-[0_0_40px_rgba(229,181,103,0.35)]">
              <Crown className="h-5 w-5 text-gold-300 drop-shadow-[0_0_10px_rgba(229,181,103,0.8)]" />
              <span className="mt-1 font-mono text-[9px] font-black tracking-[0.3em] text-gold-400 uppercase">
                MVP
              </span>
              <div className="mt-1.5 rounded-full border-2 border-gold-400/80 bg-night-950/80 p-1 shadow-[0_0_22px_rgba(229,181,103,0.5)]">
                <RoleAvatar role={mvp.role} size={56} />
              </div>
              <p className="mt-2 max-w-[140px] truncate text-sm font-black text-gold-100">
                {mvp.name}
                {mvp.id === youId && <span className="text-gold-400"> ★</span>}
              </p>
              <p className="text-[10px] font-bold text-gold-400/80">أفضل لاعب في الجلسة</p>
            </div>
          </motion.div>
        )}

        {/* match summary grid */}
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <Users className="mx-auto h-4 w-4 text-slate-400" strokeWidth={1.5} />
            <p className="mt-1.5 font-mono text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase">
              ناجون
            </p>
            <p className="mt-1 truncate text-sm font-black text-slate-100" title={survivors.map((s) => s.name).join('، ')}>
              {survivors.length > 0
                ? survivors.length === 1
                  ? survivors[0].name
                  : `${survivors.length} من الفريق الفائز`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <Timer className="mx-auto h-4 w-4 text-slate-400" strokeWidth={1.5} />
            <p className="mt-1.5 font-mono text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase">
              rounds
            </p>
            <p className="mt-1 text-sm font-black text-slate-100">{Math.max(state.round, 1)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <Target className="mx-auto h-4 w-4 text-slate-400" strokeWidth={1.5} />
            <p className="mt-1.5 font-mono text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase">
              الأكثر استهدافًا
            </p>
            <p className="mt-1 truncate text-sm font-black text-slate-100" title={mostTargeted ? mostTargeted.name : ''}>
              {mostTargeted ? `${mostTargeted.name} (${mostTargeted.count})` : '—'}
            </p>
          </div>
        </div>

        {/* actions */}
        <div className="mt-6 flex flex-col-reverse items-stretch justify-center gap-2.5 sm:flex-row">
          <button
            onClick={onLeave}
            className="btn-noir flex items-center justify-center gap-2 rounded-xl border border-night-600 bg-white/[0.05] px-6 py-3 text-sm font-bold text-slate-400 transition hover:border-blood-500/70 hover:text-blood-200"
          >
            <LogOut className="h-4 w-4" />
            الخروج للقائمة
          </button>
          <button
            onClick={onPlayAgain}
            disabled={waitingForOthers}
            className={`btn-noir flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-black text-night-950 transition ${
              waitingForOthers
                ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                : 'bg-gradient-to-r from-gold-600 to-gold-400 shadow-[0_0_28px_rgba(229,181,103,0.4)] hover:brightness-110'
            }`}
          >
            {waitingForOthers ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                مستنيين الباقي ({readyCount}/{readyTotal})
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                إعادة اللعب
              </>
            )}
          </button>
        </div>
        {youVoted && !waitingForOthers && connected.length > 1 && (
          <p className="mt-2 font-mono text-[10px] text-slate-500">
            جاهز {readyCount}/{readyTotal} — اللعبة بترجع لما الكل يوافق
          </p>
        )}
      </motion.div>
    </div>
  );
}
