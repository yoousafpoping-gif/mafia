'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Flame, ShieldCheck, Users } from 'lucide-react';
import { RolePortrait } from './RoleCard';
import { ROLE_META } from '@/lib/roles';
import { roleImage } from '@/lib/stats';
import type { Phase, YouState } from '@/lib/types';

const PHASE_EN: Partial<Record<Phase, string>> = {
  NIGHT: 'NIGHT',
  DAY_DISCUSSION: 'DAY',
  DAY_VOTING: 'TRIAL',
  DEFENSE_STAGE: 'DEFENSE',
  LAST_WORDS: 'LAST WORDS',
  GAME_OVER: 'END',
};

export function RoleRevealModal({
  open,
  onClose,
  you,
  phase,
  round,
  aliveCount,
}: {
  open: boolean;
  onClose: () => void;
  you: YouState;
  phase?: Phase;
  round?: number;
  aliveCount?: number;
}) {
  return (
    <AnimatePresence>
      {open && you.role && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.3, 0.64, 1] }}
            className="custom-scrollbar mx-auto flex h-auto max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-gold-500/30 bg-[#0b0d10] p-6 shadow-2xl"
          >
            {/* header */}
            <header className="mb-6 flex w-full shrink-0 items-center justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/50 bg-gradient-to-br from-night-700 to-night-900 font-serif text-xs font-black text-gold-300">
                  {you.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block max-w-[130px] truncate text-sm font-bold text-slate-100">
                    {you.name}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[9px] tracking-widest text-gold-400/90">
                    SECRET ROLE
                    <Flame className="h-2.5 w-2.5" />
                  </span>
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {phase && (
                  <span className="rounded-md border border-blood-500/50 bg-blood-600/20 px-2 py-1 font-mono text-[10px] font-black tracking-wider text-blood-300">
                    {PHASE_EN[phase] ?? phase} {round ?? ''}
                  </span>
                )}
                {aliveCount !== undefined && (
                  <span className="rounded-md border border-night-600 bg-night-800/80 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-slate-300">
                    SUSPECTS: {aliveCount}
                  </span>
                )}
              </div>
            </header>

            {/* card — never collapses */}
            <div className="relative flex min-h-[450px] w-full flex-1 flex-col items-center justify-center">
              <RoleArtwork role={you.role} />
              <RoleDetails you={you} />
            </div>

            {/* action — always in flow, always visible */}
            <button
              onClick={onClose}
              className="mt-6 w-full shrink-0 rounded-lg border border-gold-500 bg-red-700 py-3 text-lg font-bold text-white shadow-[0_0_15px_rgba(230,57,70,0.4)] transition-all hover:bg-red-600"
            >
              ابدأ اللعب
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RoleArtwork({ role }: { role: NonNullable<YouState['role']> }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = roleImage(role);
  const showArtwork = failedSrc !== src;
  const meta = ROLE_META[role];
  const isMafia = meta.team === 'MAFIA';
  const isNeutral = meta.team === 'NEUTRAL';

  return (
    <>
      <span
        aria-hidden
        className={`absolute inset-x-8 top-1/2 -z-10 h-40 -translate-y-1/2 rounded-full blur-3xl ${
          isMafia ? 'bg-blood-600/30' : isNeutral ? 'bg-violet-500/25' : 'bg-gold-500/25'
        }`}
        style={{ animation: 'ledPulse 3s ease-in-out infinite' }}
      />
      {/* الكارت الفعلي — صورة الدور بتغطي الإطار كله بهالة دهبية */}
      <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-lg">
        {showArtwork ? (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 80vw, 300px"
            className="h-full max-h-[500px] w-full rounded-lg object-cover ring-2 ring-gold-400/70 shadow-[0_0_40px_rgba(212,175,55,0.45)]"
            onError={() => setFailedSrc(src)}
          />
        ) : (
          <RolePortrait role={role} />
        )}
      </div>
      <p
        className={`mt-4 text-center font-serif text-2xl font-black leading-tight ${
          isMafia ? 'text-metallic-blood' : isNeutral ? 'text-violet-300' : 'text-metallic-gold'
        }`}
      >
        {isMafia ? 'المافيا' : isNeutral ? 'المحايد' : 'الأهالي'} &middot; {meta.label}
      </p>
    </>
  );
}

function RoleDetails({ you }: { you: YouState }) {
  if (!you.role) return null;
  const meta = ROLE_META[you.role];
  const isMafia = meta.team === 'MAFIA';
  const isNeutral = meta.team === 'NEUTRAL';
  const accent = isMafia ? 'text-blood-400' : isNeutral ? 'text-violet-300' : 'text-gold-400';
  const objective = isMafia
    ? 'border-blood-500/35 bg-gradient-to-br from-blood-700/25 to-transparent'
    : isNeutral
      ? 'border-violet-500/35 bg-gradient-to-br from-violet-600/20 to-transparent'
      : 'border-gold-500/35 bg-gradient-to-br from-gold-600/15 to-transparent';

  return (
    <>
      <p className="mt-1 text-center text-xs italic text-slate-400">{meta.tagline}</p>

      <div className={`mt-3 w-full rounded-xl border p-3 ${objective}`}>
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-200">
          <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
          <span>
            <span className={`font-black ${accent}`}>مهمتك: </span>
            {meta.abilityText}
          </span>
        </p>
      </div>

      {isMafia && you.partners.length > 0 && (
        <div className="mt-2.5 w-full px-1">
          <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold tracking-[0.3em] text-slate-500 uppercase">
            <Users className="h-3 w-3" /> أهل بيتك
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {you.partners.map((partner) => (
              <li key={partner.id} className="text-xs font-bold text-blood-400">
                {partner.name}
                {!partner.isAlive && <span className="ml-1 text-slate-600">(ميت)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {you.hasRevealed && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-gold-300">
          <Crown className="h-3.5 w-3.5" /> صوتك بقى ×3
        </p>
      )}
    </>
  );
}
