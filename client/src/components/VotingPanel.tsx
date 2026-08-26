'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Gavel, Lock } from 'lucide-react';
import { playSfx } from '@/lib/sfx';
import { roleLabel } from '@/lib/roles';
import type { GameState, PublicPlayer, VoteResultPayload } from '@/lib/types';

export function VotingPanel({
  state,
  voteProgress,
  voteResult,
  onVote,
}: {
  state: GameState;
  voteProgress: { cast: number; expected: number } | null;
  voteResult: VoteResultPayload | null;
  onVote: (targetId: string) => void;
}) {
  const you = state.you!;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (voteResult) playSfx('stamp');
  }, [voteResult]);

  const candidates = state.players.filter(
    (player) => player.isAlive && player.id !== you.id,
  );
  const myVote = you.voteTarget;
  const hasVoted = Boolean(myVote);
  // مرحلة الدفاع: صوتك مش مقفول — تقدر تغيّره لأي حد أو تأكد الحالي
  const voteShifting = state.phase === 'DEFENSE_STAGE';
  const voteLog = state.voteLog ?? [];
  const votesFor = (targetId: string) =>
    voteLog
      .filter((entry) => entry.targetId === targetId)
      .map((entry) => state.players.find((p) => p.id === entry.voterId)?.name ?? 'حد');

  if (voteResult) {
    return <VoteResultCard result={voteResult} players={state.players} />;
  }

  const expected = voteProgress?.expected ?? state.votesExpected;
  const cast = voteProgress?.cast ?? state.votesCast;

  return (
    <section className="rounded-2xl border border-blood-500/30 bg-night-850/80 p-3 shadow-xl backdrop-blur sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-serif text-lg font-black text-slate-100">
          <Gavel className="h-5 w-5 text-blood-400" />
          {voteShifting ? 'الدفاع — التصويت لسه بيتحرك' : 'المحاكمة'}
        </h3>
        <span className="font-mono text-xs text-slate-500">
          وصل {cast}/{expected}
        </span>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-night-700">
        <motion.div
          className="h-full bg-gradient-to-r from-gold-600 to-gold-400"
          animate={{ width: `${expected ? (cast / expected) * 100 : 0}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      {you.isSilenced && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-blood-500/40 bg-blood-600/10 px-3 py-2 text-xs text-blood-300">
          <Lock className="h-3.5 w-3.5" />
          المافيا سكّتك — صوتك بيتعد صفر النهارده.
        </p>
      )}

      {hasVoted && !voteShifting ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-night-600 bg-night-800/60 py-4 text-sm text-slate-400">
          <Check className="h-4 w-4 text-emerald-400" />
          صوتك اتقفل خلاص.
        </p>
      ) : !you.isAlive ? (
        <p className="py-4 text-center text-sm italic text-slate-500">
          الميت ملوش لسان في المحاكمة.
        </p>
      ) : (
        <>
          {hasVoted && voteShifting ? (
            <p className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/10 px-2 py-1.5 text-center text-xs font-bold text-gold-300">
              صوتك حاليًا على{' '}
              {state.players.find((p) => p.id === myVote)?.name ?? 'حد'} — غيّره أو تأكده قبل
              ما الوقت يخلص!
            </p>
          ) : (
            <p className="mb-3 text-center text-xs font-bold tracking-widest text-slate-500 uppercase">
              اختار مين يتدفع تمن الليلة
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {candidates.map((player) => (
              <CandidateButton
                key={player.id}
                player={player}
                selected={selected === player.id}
                voterNames={votesFor(player.id)}
                onSelect={() => setSelected(player.id)}
              />
            ))}
          </div>
          <button
            onClick={() => selected && onVote(selected)}
            disabled={!selected}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-blood-700 to-blood-500 py-3 font-bold text-white shadow-lg transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {hasVoted && voteShifting ? 'أكّد صوتك' : 'صوّت بإعدام'}{' '}
            {selected && `· ${state.players.find((p) => p.id === selected)?.name}`}
          </button>
        </>
      )}
    </section>
  );
}

function CandidateButton({
  player,
  selected,
  voterNames,
  onSelect,
}: {
  player: PublicPlayer;
  selected: boolean;
  voterNames: string[];
  onSelect: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      layout
      className={`relative min-h-11 min-w-0 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
        selected
          ? 'border-blood-500 bg-blood-600/25 text-white shadow-[0_0_18px_rgba(220,38,38,0.35)]'
          : 'border-night-600 bg-night-800/70 text-slate-200 hover:border-slate-500'
      }`}
    >
      <span className="block break-words leading-snug">{player.name}</span>
      <AnimatePresence>
        {voterNames.map((name) => (
          <motion.span
            key={`${player.id}-${name}`}
            initial={{ opacity: 0, y: -14, scale: 0.6, rotate: -12 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="absolute -top-2.5 -left-1.5 rounded-full border border-blood-400/60 bg-night-950 px-1.5 py-0.5 font-mono text-[9px] font-bold text-blood-300 shadow-lg"
          >
            {name}
          </motion.span>
        ))}
      </AnimatePresence>
      {voterNames.length > 0 && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-blood-600 px-2 py-0.5 font-mono text-[10px] font-black text-white shadow">
          {voterNames.length}
        </span>
      )}
    </motion.button>
  );
}

function VoteResultCard({
  result,
  players,
}: {
  result: VoteResultPayload;
  players: GameState['players'];
}) {
  const maxVotes = Math.max(1, ...result.tally.map((row) => row.weightedVotes));

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gold-500/30 bg-night-850/90 p-5 shadow-xl backdrop-blur"
    >
      <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-black text-slate-100">
        <Gavel className="h-5 w-5 text-gold-400" />
        نتيجة التصويت — النهار {result.round}
      </h3>

      {result.tied && (
        <p className="mb-4 rounded-lg border border-night-600 bg-night-800 px-4 py-2 text-center text-sm text-slate-400">
          تعادل عند {result.topCount} صوت. محدش هيتعدم النهارده.
        </p>
      )}

      {!result.tied && result.tally.length === 0 && (
        <p className="mb-4 rounded-lg border border-night-600 bg-night-800 px-4 py-2 text-center text-sm text-slate-400">
          مفيش حد صوّت أصلاً.
        </p>
      )}

      <div className="space-y-2">
        {result.tally.map((row, index) => (
          <div key={row.playerId}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className={index === 0 && !result.tied ? 'font-semibold text-gold-300' : 'text-slate-300'}>
                {row.name}
              </span>
              <span className="font-mono text-xs text-slate-500">{row.weightedVotes} W</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-night-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(row.weightedVotes / maxVotes) * 100}%` }}
                transition={{ delay: index * 0.12, type: 'spring', stiffness: 80 }}
                className={`h-full ${
                  index === 0 && !result.tied
                    ? 'bg-gradient-to-r from-blood-700 to-blood-400'
                    : 'bg-gradient-to-r from-night-600 to-slate-600'
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {result.eliminated && (
          <motion.div
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-5 flex flex-col items-center rounded-xl border border-blood-500/40 bg-gradient-to-b from-blood-700/20 to-transparent p-4"
          >
            <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">اتعدم</span>
            <span className="text-glow-blood mt-1 font-serif text-2xl font-black text-white">
              {result.eliminated.name}
            </span>
            <span className="mt-1 text-sm text-blood-300">
              كان {roleLabel(result.eliminated.role)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {result.weights.map((weight) => (
          <span
            key={weight.playerId}
            title={`${weight.name} صوته بيعد ×${weight.weight}`}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              weight.weight === 0
                ? 'border-blood-500/50 bg-blood-600/10 text-blood-400'
                : weight.weight === 3
                  ? 'border-gold-500/50 bg-gold-500/10 text-gold-300'
                  : 'border-night-600 bg-night-800 text-slate-500'
            }`}
          >
            {weight.name} x{weight.weight}
          </span>
        ))}
      </div>

      {players === null && null}
    </motion.section>
  );
}
