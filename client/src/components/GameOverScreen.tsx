'use client';

import { motion } from 'framer-motion';
import { Check, Loader2, LogOut, RotateCcw, Skull, Trophy, WifiOff } from 'lucide-react';
import { RoleAvatar } from './Avatars';
import { ROLE_META } from '@/lib/roles';
import type { PublicPlayer, RoomResult } from '@/lib/types';

export function GameOverScreen({
  result,
  youId,
  isHost,
  players,
  rematchVotes,
  onVoteRematch,
  onPlayAgain,
  onLeave,
}: {
  result: RoomResult;
  youId: string;
  isHost: boolean;
  players: PublicPlayer[];
  rematchVotes: string[];
  onVoteRematch: (ready: boolean) => void;
  onPlayAgain: () => void;
  onLeave: () => void;
}) {
  const townWon = result.winner === 'TOWN';
  const connected = players.filter((p) => p.isConnected);
  const readyCount = rematchVotes.filter((id) =>
    connected.some((p) => p.id === id),
  ).length;
  const readyTotal = Math.max(connected.length, 1);
  const youVoted = rematchVotes.includes(youId);
  const allReady = readyCount >= connected.length && connected.length > 0;

  return (
    <section className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        className={`w-full max-w-xl rounded-3xl border p-8 text-center shadow-2xl ${
          townWon
            ? 'border-gold-500/50 bg-gradient-to-b from-gold-500/10 to-transparent shadow-[0_0_80px_rgba(229,181,103,0.2)]'
            : 'border-blood-500/50 bg-gradient-to-b from-blood-700/20 to-transparent shadow-[0_0_80px_rgba(220,38,38,0.25)]'
        }`}
      >
        <Trophy className={`mx-auto h-12 w-12 ${townWon ? 'text-gold-400' : 'text-blood-400'}`} />
        <h2 className="text-glow-gold mt-4 font-serif text-4xl font-black tracking-wide text-white">
          {townWon ? 'الأهالي كسبوا!' : 'المافيا سيطرت!'}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{result.reason}</p>
      </motion.div>

      <div className="mt-6 grid w-full max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-3">
        {result.roster.map((seat, index) => {
          const meta = seat.role ? ROLE_META[seat.role] : null;
          const mafia = meta?.team === 'MAFIA';
          const live = players.find((p) => p.id === seat.id);
          const departed = live ? !live.isConnected : true;
          return (
            <motion.div
              key={seat.id}
              initial={{ opacity: 0, y: 16, rotateY: 90 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              transition={{ delay: 0.35 + index * 0.08 }}
              className={`relative rounded-xl border p-3 text-center ${
                mafia
                  ? 'border-blood-500/50 bg-blood-600/10'
                  : 'border-gold-500/40 bg-gold-500/5'
              } ${seat.isAlive ? '' : 'opacity-55'}`}
            >
              <div className="mx-auto w-fit">
                {seat.role && <RoleAvatar role={seat.role} size={44} />}
              </div>
              <p className="mt-1.5 truncate text-sm font-bold text-slate-100">
                {seat.name}
                {seat.id === youId && <span className="ml-1 text-xs text-gold-400">*</span>}
                {live?.isBot && <span className="ml-1 text-[10px]">🤖</span>}
              </p>
              <p className={`flex items-center justify-center gap-1 text-[11px] ${mafia ? 'text-blood-300' : 'text-gold-500'}`}>
                {meta?.label}
                {rematchVotes.includes(seat.id) && !departed && (
                  <Check className="h-3 w-3 text-emerald-400" aria-label="جاهز للريفانش" />
                )}
                {departed && (
                  <WifiOff className="h-3 w-3 text-slate-500" aria-label="خرج من الأوضة" />
                )}
              </p>
              {!seat.isAlive && (
                <Skull className="absolute top-2 right-2 h-3.5 w-3.5 text-slate-500" />
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-8 w-full max-w-xl rounded-2xl border border-night-600/70 bg-night-850/80 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg font-black tracking-wide text-slate-100">
              مجلس الريفانش
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              لما الكل يوافق، الليل بينزل تاني على طول.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-sm font-black ${
              allReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-night-700/70 text-slate-300'
            }`}
          >
            جاهز {readyCount}/{readyTotal}
          </span>
        </div>

        <button
          onClick={() => onVoteRematch(!youVoted)}
          disabled={youVoted && allReady}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-black shadow-lg transition enabled:hover:brightness-110 disabled:opacity-70 ${
            youVoted
              ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
              : 'bg-gradient-to-r from-gold-600 to-gold-500 text-night-950'
          }`}
        >
          {youVoted ? (
            <>
              <Check className="h-4 w-4" /> صوّتت للريفانش
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" /> عايز نلعب تاني!
            </>
          )}
        </button>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            {allReady
              ? 'اتفقوا خلاص.. بنوزع الأدوار من جديد...'
              : `مستنيين ${readyTotal - readyCount} لاعب...`}
          </p>
          <div className="flex gap-2">
            {isHost && (
              <button
                onClick={onPlayAgain}
                title="ابدأ بنفس اللي موجودين دلوقتي"
                className="flex items-center gap-1.5 rounded-lg border border-night-600 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-gold-500/60 hover:text-gold-300"
              >
                {allReady ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                ابدأ بالعافية (هوست)
              </button>
            )}
            <button
              onClick={onLeave}
              className="flex items-center gap-1.5 rounded-lg border border-night-600 px-3 py-2 text-xs font-bold text-slate-400 transition hover:border-blood-500/60 hover:text-blood-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              خرج من الأوضة
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
