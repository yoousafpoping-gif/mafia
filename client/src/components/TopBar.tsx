'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CircleHelp, Coins, Crown, Gem, LogOut, ScrollText, Settings, Skull, Trophy } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import { GOLD_ICON } from '@/styles/themeConfig';
import { GAME_LOGO, GAME_TITLE } from '@/lib/branding';
import { useAuth } from '@/context/AuthContext';
import { LeaderboardModal } from './LeaderboardModal';
import { MicButton } from './MicButton';
import { SettingsModal } from './SettingsModal';
import type { GameState } from '@/lib/types';
import type { VoiceController } from '@/hooks/useVoiceChat';

const PHASE_AR: Record<string, string> = {
  LOBBY: 'الاستعداد',
  NIGHT: 'ليل',
  DAY_DISCUSSION: 'نقاش',
  DAY_VOTING: 'محاكمة',
  DEFENSE_STAGE: 'دفاع',
  LAST_WORDS: 'آخر كلام',
  GAME_OVER: 'النهاية',
};

export function TopBar({
  state,
  connected,
  voice,
  onOpenHelp,
  onOpenLog,
  onLeave,
}: {
  state: GameState;
  connected: boolean;
  voice: VoiceController;
  onOpenHelp: () => void;
  onOpenLog: () => void;
  onLeave: () => void;
}) {
  const secondsLeft = useCountdown(state.deadline);
  const aliveCount = state.players.filter((p) => p.isAlive).length;
  const you = state.you!;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const { user, profile } = useAuth();

  return (
    <>
      <header className="relative z-50 flex w-full shrink-0 items-center justify-between gap-1 border-b border-gold-500/20 bg-black/30 p-2.5 backdrop-blur-md sm:gap-2 sm:p-4">
      {/* start cluster — براند حارة المافيا + بيانات الأوضة */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <span className="flex shrink-0 items-center gap-1.5" title={GAME_TITLE}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={GAME_LOGO}
            alt={GAME_TITLE}
            className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(212,175,55,0.6)]"
          />
          <span className="hidden font-serif text-sm font-black whitespace-nowrap text-gold-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] xs:inline sm:inline">
            {GAME_TITLE}
          </span>
        </span>
        <span className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-1.5 py-1 font-mono text-[10px] font-black tracking-widest text-gold-300 sm:px-2 sm:text-[11px]">
          {state.code}
        </span>
        {state.phase !== 'LOBBY' && (
          <>
            <span className="hidden rounded-lg border border-blood-500/40 bg-blood-600/15 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-blood-300 xs:inline-block sm:inline-block">
              {PHASE_AR[state.phase] ?? state.phase}
              {state.round > 0 && ` ${state.round}`}
            </span>
            <span className="flex items-center gap-1 rounded-lg border border-night-600 bg-night-800/80 px-2 py-1 font-mono text-[10px] font-bold text-slate-300">
              <Skull className="h-3 w-3" strokeWidth={1.5} />
              {aliveCount}
            </span>
            {secondsLeft !== null && (
              <motion.span
                animate={secondsLeft <= 5 ? { scale: [1, 1.12, 1] } : {}}
                transition={{ repeat: secondsLeft <= 5 ? Infinity : 0, duration: 0.6 }}
                className={`rounded-lg border px-2 py-1 font-mono text-[11px] font-black tabular-nums ${
                  secondsLeft <= 5
                    ? 'border-blood-500/60 text-blood-300'
                    : 'border-night-600 bg-night-800/80 text-slate-200'
                }`}
              >
                {secondsLeft}ث
              </motion.span>
            )}
          </>
        )}
        {you.hasRevealed && (
          <span className="flex items-center gap-1 rounded-lg border border-gold-400/70 bg-gold-500/15 px-2 py-1 font-mono text-[10px] font-black text-gold-300 shadow-[0_0_12px_rgba(229,181,103,0.35)]">
            <Crown className="h-3 w-3" strokeWidth={1.5} /> عمدة ×3
          </span>
        )}
        <span
          title={connected ? 'متصل' : 'بتعيد الاتصال..'}
          className={`ml-0.5 h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'animate-pulse bg-blood-500'}`}
        />
      </div>

      {/* end cluster */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {user && (
          <span
            title={`${user.displayName} · ${profile?.coins ?? '—'} كوينز · ${profile?.gems ?? '—'} جواهر`}
            className="hidden items-center gap-1 xs:flex"
          >
            <span className="flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-500/10 px-1.5 py-1 font-mono text-[9px] font-black text-gold-300 sm:px-2 sm:text-[10px]">
              <Coins className="h-3 w-3 shrink-0" />
              {profile?.coins ?? '—'}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-1.5 py-1 font-mono text-[9px] font-black text-cyan-200 sm:px-2 sm:text-[10px]">
              <Gem className="h-3 w-3 shrink-0" />
              {profile?.gems ?? '—'}
            </span>
          </span>
        )}
        <MicButton voice={voice} />
        <button
          onClick={() => setLeaderboardOpen(true)}
          title="لوحة الصدارة الأسبوعية"
          className={`hidden h-9 w-9 items-center justify-center rounded-full transition sm:flex ${GOLD_ICON}`}
        >
          <Trophy className="h-4.5 w-4.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          title="إعدادات الصوت"
          className={`hidden h-9 w-9 items-center justify-center rounded-full transition sm:flex ${GOLD_ICON}`}
        >
          <Settings className="h-4.5 w-4.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={onOpenLog}
          title="سجل المجلس"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${GOLD_ICON}`}
        >
          <ScrollText className="h-4.5 w-4.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={onOpenHelp}
          title="تعليمات اللعبة"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${GOLD_ICON}`}
        >
          <CircleHelp className="h-4.5 w-4.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={onLeave}
          title="اطلع من الأوضة"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${GOLD_ICON}`}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
      </header>

      {/* المودالات لازم بره الهيدر — الـ backdrop-blur عليه بيحبس العناصر
          الـ fixed جواه فبتترندر مقصوصة بالنسبة للهيدر مش للشاشة */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
    </>
  );
}
