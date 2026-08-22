'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, Crown, Link2, Play, Users, UserPlus } from 'lucide-react';
import { BotAvatar } from './Avatars';
import type { GameState } from '@/lib/types';
import { LIMITS_HINT_MIN, LIMITS_HINT_MAX } from '@/lib/constants';

export function LobbyView({
  state,
  onStart,
  onAddBot,
}: {
  state: GameState;
  onStart: () => void;
  onAddBot: (count: number) => void;
}) {
  const players = state.players;
  const isHost = state.you?.isHost ?? false;
  const canStart = isHost && players.length >= LIMITS_HINT_MIN;
  const fillTarget = Math.min(6, LIMITS_HINT_MAX);
  const neededForFull = Math.max(0, fillTarget - players.length);
  const [inviteCopied, setInviteCopied] = useState(false);

  const copyInviteLink = async () => {
    try {
      const link = `${window.location.origin}/game?code=${state.code}&invite=1`;
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard blocked — اللينك موجود في الكود على أي حال */
    }
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 2000);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full rounded-2xl border border-night-600/60 bg-night-850/80 p-6 shadow-2xl backdrop-blur sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-black text-slate-100">الأوضة</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <Users className="h-4 w-4" />
              {players.length} / {LIMITS_HINT_MAX} قعدوا · ابعت الكود لأصحابك
            </p>
          </div>
          <span className="rounded-lg border border-blood-500/40 bg-blood-600/10 px-3 py-1.5 font-mono text-xs text-blood-400">
            ناقص {Math.max(0, LIMITS_HINT_MIN - players.length)}
          </span>
        </div>

        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {players.map((player, index) => (
            <motion.li
              key={player.id}
              layout
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                player.id === state.you?.id
                  ? 'border-gold-500/40 bg-gold-500/10'
                  : 'border-night-600/70 bg-night-800/60'
              } ${player.isConnected ? '' : 'opacity-40'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                {player.isBot ? (
                  <BotAvatar size={36} />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-night-600 to-night-800 font-serif text-sm font-black text-gold-300">
                    {player.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">
                {player.name}
                {player.id === state.you?.id && (
                  <span className="ml-2 text-xs text-gold-400">(إنت)</span>
                )}
              </span>
              {player.isBot && (
                <span className="rounded-md border border-gold-500/40 bg-gold-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gold-300">
                  بوت
                </span>
              )}
              {player.isHost && <Crown className="h-4 w-4 shrink-0 text-gold-400" />}
            </motion.li>
          ))}
        </ul>

        <div className="mt-8">
          <button
            onClick={() => void copyInviteLink()}
            className="mx-auto mb-4 flex items-center gap-1.5 rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 font-mono text-[11px] font-bold text-gold-300 transition hover:bg-gold-500/20"
          >
            {inviteCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" /> لينك الدعوة اتنسخ!
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" /> انسخ لينك الدعوة لأصحابك
              </>
            )}
          </button>
          {isHost && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => onAddBot(1)}
                disabled={players.length >= LIMITS_HINT_MAX}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gold-500/50 bg-gold-500/10 px-4 py-2.5 text-sm font-bold text-gold-300 transition enabled:hover:scale-[1.05] enabled:hover:bg-gold-500/20 disabled:opacity-40"
              >
                <UserPlus className="h-4 w-4" />
                ضيف بوت
              </button>
              <button
                onClick={() => onAddBot(neededForFull)}
                disabled={neededForFull <= 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-night-600 bg-night-800 px-4 py-2.5 text-sm font-bold text-slate-300 transition enabled:hover:scale-[1.05] enabled:hover:border-gold-500/60 disabled:opacity-40"
              >
                <Bot className="h-4 w-4" />
                كمّل الأوضة بوتات
              </button>
            </div>
          )}
          {isHost ? (
            <motion.button
              whileHover={canStart ? { scale: 1.02 } : undefined}
              whileTap={canStart ? { scale: 0.98 } : undefined}
              onClick={onStart}
              disabled={!canStart}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-700 via-blood-600 to-blood-500 px-6 py-4 font-serif text-lg font-bold tracking-wide text-white shadow-xl shadow-blood-900/40 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-5 w-5" />
              يلا نبدأ اللعب
            </motion.button>
          ) : (
            <p className="text-center text-sm italic text-slate-500">
              مستنيين صاحب الأوضة يبدأ الليل...
            </p>
          )}
          {!isHost || !canStart ? (
            <p className="mt-3 text-center text-xs text-slate-600">
              الأدوار هتتوزع بالسر لما تبدأ اللعبة.
            </p>
          ) : null}
        </div>
      </motion.div>
    </main>
  );
}
