'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Gavel, Mic, MicOff, MoonStar, ScrollText, Skull, Trophy, X } from 'lucide-react';
import { DRAWER_SHELL, GLASS_PANEL, GOLD_FRAME, METAL_HEADER, MICRO_LABEL } from '@/styles/themeConfig';
import type { GameState, Phase, PublicPlayer } from '@/lib/types';

const PHASE_AR: Partial<Record<Phase, string>> = {
  LOBBY: 'الاستعداد',
  NIGHT: 'الليل',
  DAY_DISCUSSION: 'النقاش',
  DAY_VOTING: 'المحاكمة',
  LAST_WORDS: 'آخر كلام',
  GAME_OVER: 'الحكم النهائي',
};

const LOG_ICON: Record<string, React.ReactNode> = {
  NIGHT: <MoonStar className="h-3.5 w-3.5 shrink-0 text-slate-400" />,
  MAYOR: <Crown className="h-3.5 w-3.5 shrink-0 text-gold-400" />,
  VOTE: <Gavel className="h-3.5 w-3.5 shrink-0 text-blood-300" />,
  EXECUTION: <Gavel className="h-3.5 w-3.5 shrink-0 text-blood-400" />,
  LAST_WORDS: <Mic className="h-3.5 w-3.5 shrink-0 text-gold-300" />,
  WIN: <Trophy className="h-3.5 w-3.5 shrink-0 text-gold-400" />,
  INFO: <ScrollText className="h-3.5 w-3.5 shrink-0 text-slate-500" />,
};

export function GameLogPanel({
  state,
  open,
  onClose,
}: {
  state: GameState;
  open: boolean;
  onClose: () => void;
}) {
  const nameOf = new Map(state.players.map((player) => [player.id, player.name]));
  const dead = state.players.filter((player) => !player.isAlive);
  const muted = state.players.filter((player) => player.isSilenced && player.isAlive);
  const mayor = state.players.find((player) => player.hasRevealed);
  const votes = state.phase === 'DAY_DISCUSSION' || state.phase === 'DAY_VOTING' ? state.voteLog ?? [] : [];

  const groupedVotes = new Map<string, string[]>();
  for (const entry of votes) {
    const list = groupedVotes.get(entry.targetId) ?? [];
    list.push(nameOf.get(entry.voterId) ?? '؟');
    groupedVotes.set(entry.targetId, list);
  }
  const sortedTargets = [...groupedVotes.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-night-950/70 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: '110%' }}
            animate={{ x: 0 }}
            exit={{ x: '110%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={`${GLASS_PANEL} ${DRAWER_SHELL} fixed inset-y-0 z-[75] border-s-0`}
          >
            <span aria-hidden className="crimson-edge pointer-events-none absolute inset-y-6 -left-px w-px" />

            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gold-500/20 px-4 py-3">
              <h3 className={`${METAL_HEADER} flex items-center gap-2 text-base`}>
                <ScrollText className="h-4 w-4 text-gold-400" />
                سجل المجلس
              </h3>
              <button onClick={onClose} className="btn-noir flex h-8 w-8 items-center justify-center rounded-full border border-night-600 bg-night-900/80 text-slate-300 transition hover:border-blood-500/60 hover:text-blood-300">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* current phase */}
              <section>
                <SectionTitle>وضع اللعبة</SectionTitle>
                <div className={`${GOLD_FRAME} mt-2 flex items-center justify-between rounded-xl px-3 py-2.5`}>
                  <span className="font-serif text-sm font-black text-gold-200">
                    {PHASE_AR[state.phase] ?? state.phase}
                    {state.round > 0 && ` · ليلة ${state.round}`}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-blood-300">
                    <Skull className="h-3 w-3" />
                    {state.players.filter((p) => p.isAlive).length} أحياء
                  </span>
                </div>
                {mayor && (
                  <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-gold-500/30 bg-gold-500/10 px-2.5 py-1.5 text-xs text-gold-300">
                    <Crown className="h-3.5 w-3.5" />
                    العمدة <b>{mayor.name}</b> كشف هويته — صوته بـ×3
                  </p>
                )}
              </section>

              {/* detective feed — every server-side headline in order */}
              {(state.eventLog ?? []).length > 0 && (
                <section>
                  <SectionTitle>
                    <ScrollText className="h-3 w-3 text-gold-400" /> عناوين الجريمة
                  </SectionTitle>
                  <ul className="mt-2 space-y-1.5">
                    {[...(state.eventLog ?? [])].reverse().map((event, index) => (
                      <li
                        key={`${event.at}-${index}`}
                        className="flex items-start gap-2 rounded-lg border border-night-600/60 bg-night-900/60 px-2.5 py-1.5"
                      >
                        {LOG_ICON[event.kind] ?? LOG_ICON.INFO}
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs leading-relaxed font-semibold text-slate-200">
                            {event.text}
                          </span>
                          <span className="mt-0.5 block font-mono text-[9px] tracking-widest text-slate-600 uppercase">
                            {event.kind.toLowerCase()} · round {event.round}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* live trial tally */}
              {sortedTargets.length > 0 && (
                <section>
                  <SectionTitle>
                    <Gavel className="h-3 w-3 text-blood-400" /> اتهامات النهارده
                  </SectionTitle>
                  <ul className="mt-2 space-y-1.5">
                    {sortedTargets.map(([targetId, voters]) => (
                      <li key={targetId} className="rounded-lg border border-blood-500/25 bg-blood-700/15 px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-black text-slate-100">{nameOf.get(targetId) ?? 'مجهول'}</span>
                          <span className="shrink-0 rounded-full bg-blood-600 px-1.5 font-mono text-[10px] font-black text-white shadow-[0_0_10px_rgba(220,38,38,0.6)]">
                            {voters.length}
                            {mayor?.id === targetId && voters.length > 0 ? ` (فعلي ×${voters.length * 3})` : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] italic text-slate-400">صوّتوا: {voters.join('، ')}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* silenced */}
              {muted.length > 0 && (
                <section>
                  <SectionTitle>
                    <MicOff className="h-3 w-3 text-blood-400" /> مكتومين اللسان
                  </SectionTitle>
                  <ul className="mt-2 space-y-1">
                    {muted.map((player) => (
                      <PlayerLine key={player.id} player={player} />
                    ))}
                  </ul>
                </section>
              )}

              {/* the fallen */}
              {dead.length > 0 ? (
                <section>
                  <SectionTitle>
                    <Skull className="h-3 w-3 text-slate-400" /> شهداء المدينة
                  </SectionTitle>
                  <ul className="mt-2 space-y-1">
                    {dead.map((player) => (
                      <PlayerLine key={player.id} player={player} />
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="rounded-xl border border-night-600/60 bg-night-900/60 px-3 py-4 text-center text-xs italic text-slate-500">
                  لسه مفيش ضحايا.. المدينة ليه فرصة.
                </p>
              )}
            </div>

            <footer className="shrink-0 border-t border-gold-500/20 px-4 py-2.5 text-center">
              <span className={MICRO_LABEL}>mafia undercover · case file</span>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.25em] text-gold-400/90 uppercase">
      {children}
      <span className="h-px flex-1 bg-gradient-to-l from-gold-500/40 to-transparent" />
    </h4>
  );
}

function PlayerLine({ player }: { player: PublicPlayer }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-night-600/60 bg-night-900/60 px-2.5 py-1.5">
      {player.isSilenced && !player.isAlive ? (
        <Skull className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      ) : (
        <MicOff className="h-3.5 w-3.5 shrink-0 text-blood-400" />
      )}
      <span className={`truncate text-xs font-bold ${!player.isAlive ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
        {player.name}
        {player.isBot && ' 🤖'}
      </span>
    </li>
  );
}
