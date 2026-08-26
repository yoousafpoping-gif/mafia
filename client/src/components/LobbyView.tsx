'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, Crown, Link2, Play, Users, UserPlus, UserX } from 'lucide-react';
import { BotAvatar } from './Avatars';
import { frameImage, titleName } from '@/lib/cosmetics';
import type { GameState } from '@/lib/types';
import { LIMITS_HINT_MIN, LIMITS_HINT_MAX } from '@/lib/constants';

export function LobbyView({
  state,
  onStart,
  onUpdateSettings,
  onAddBot,
  onKick,
}: {
  state: GameState;
  onStart: () => void;
  onUpdateSettings: (settings: GameState['settings']) => void;
  onAddBot: (count: number) => void;
  onKick: (playerId: string) => void;
}) {
  const players = state.players;
  const isHost = state.you?.isHost ?? false;
  const target = state.settings.targetPlayerCount;
  const canStart = isHost && players.length >= LIMITS_HINT_MIN && (target === null || players.length === target);
  const fillTarget = target ?? Math.min(6, LIMITS_HINT_MAX);
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
    <div className="relative min-h-screen w-full overflow-hidden bg-[url('/assets/backgrounds/lobby-bg.jpeg')] bg-cover bg-center bg-fixed">
      <div className="absolute inset-0 z-0 bg-black/70" />
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-sm border-2 border-amber-900/70 bg-[#1c1917] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.9),8px_8px_0_rgba(0,0,0,0.65)] before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(245,158,11,0.025)_4px)] before:content-[''] sm:p-8"
        >
        <div className="relative mb-6 flex items-center justify-between border-b-2 border-dashed border-amber-900/60 pb-5">
          <div>
            <h2 className="font-serif text-2xl font-black uppercase tracking-wider text-amber-400 [text-shadow:2px_2px_0_#000,0_0_14px_rgba(245,158,11,0.25)]">الأوضة</h2>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-sm text-stone-400">
              <Users className="h-4 w-4 text-amber-700" />
              {players.length} / {LIMITS_HINT_MAX} قعدوا · ابعت الكود لأصحابك
            </p>
          </div>
          <span className="rotate-[-2deg] border-2 border-red-900/80 bg-red-950/30 px-3 py-1.5 font-mono text-xs font-black uppercase text-red-500 shadow-[2px_2px_0_#000]">
            ناقص {Math.max(0, LIMITS_HINT_MIN - players.length)}
          </span>
        </div>

        <ul className="relative grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {players.map((player, index) => (
            <motion.li
              key={player.id}
              layout
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-3 rounded-sm border-2 px-4 py-3 shadow-[3px_3px_0_rgba(0,0,0,0.65)] ${
                player.id === state.you?.id
                  ? 'border-amber-600/70 bg-amber-950/35'
                  : 'border-stone-700 bg-[#29231e]'
              } ${player.isConnected ? '' : 'opacity-40'}`}
            >
              <span className="relative flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-950 shadow-[2px_2px_0_#000]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frameImage(player.cosmetics?.cardFrame)} alt="" aria-hidden className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none" />
                {player.isBot ? (
                  <BotAvatar size={26} />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-stone-700 to-stone-950 font-serif text-[10px] font-black text-amber-300">
                    {player.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-stone-200">
                {player.name}
                {player.id === state.you?.id && (
                  <span className="ml-2 text-xs text-amber-500">(إنت)</span>
                )}
                {titleName(player.cosmetics?.title) && (
                  <span className="ml-1.5 inline-block translate-y-[-1px] rounded-full border border-amber-600/60 bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-black text-amber-400">
                    {titleName(player.cosmetics?.title)}
                  </span>
                )}
              </span>
              {player.isBot && (
                <span className="rotate-[-2deg] border border-amber-700/70 bg-amber-950/40 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-400">
                  بوت
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-black ${player.isConnected ? 'bg-emerald-950 text-emerald-400' : 'bg-stone-900 text-stone-500'}`}>
                {player.isConnected ? 'متصل' : 'يعيد الاتصال'}
              </span>
              {isHost && !player.isHost && (
                <button
                  type="button"
                  onClick={() => onKick(player.id)}
                  title={`طرد ${player.name}`}
                  className="rounded border border-red-900 bg-red-950/60 p-1 text-red-400 hover:bg-red-900 hover:text-white"
                >
                  <UserX className="h-4 w-4" />
                </button>
              )}
              {player.isHost && <Crown className="h-4 w-4 shrink-0 text-amber-400 drop-shadow-[1px_1px_0_#000]" />}
            </motion.li>
          ))}
        </ul>

        <div className="relative mt-8 border-t border-amber-950/80 pt-5">
          {state.isCustomRoom && <section className="mb-4 rounded border border-amber-900/70 bg-black/25 p-3">
            <h3 className="mb-2 text-sm font-black text-amber-300">إعدادات الغرفة المخصصة</h3>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <SettingNumber label="اللاعبون" value={state.settings.targetPlayerCount ?? players.length} min={LIMITS_HINT_MIN} max={LIMITS_HINT_MAX} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, targetPlayerCount: value })} />
              <SettingNumber label="المافيا" value={state.settings.mafiaCount ?? state.settings.effectiveMafiaCount} min={1} max={state.settings.maxMafiaCount} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, mafiaCount: value })} />
              <SettingNumber label="الليل (ث)" value={state.settings.timers.nightMs / 1000} min={10} max={300} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, timers: { ...state.settings.timers, nightMs: value * 1000 } })} />
              <SettingNumber label="النقاش (ث)" value={state.settings.timers.discussionMs / 1000} min={10} max={300} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, timers: { ...state.settings.timers, discussionMs: value * 1000 } })} />
              <SettingNumber label="التصويت (ث)" value={state.settings.timers.votingMs / 1000} min={10} max={300} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, timers: { ...state.settings.timers, votingMs: value * 1000 } })} />
              <SettingNumber label="الدفاع (ث)" value={state.settings.timers.defenseMs / 1000} min={10} max={300} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, timers: { ...state.settings.timers, defenseMs: value * 1000 } })} />
              <SettingNumber label="الكلمة الأخيرة (ث)" value={state.settings.timers.lastWordsMs / 1000} min={10} max={300} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, timers: { ...state.settings.timers, lastWordsMs: value * 1000 } })} />
              <SettingNumber label="وزن العمدة" value={state.settings.voting.mayorWeight} min={1} max={3} disabled={!isHost} onChange={(value) => onUpdateSettings({ ...state.settings, voting: { ...state.settings.voting, mayorWeight: value as 1 | 2 | 3 } })} />
            </div>
            <p className="mt-2 text-[10px] text-stone-500">التعادل: لا إعدام. لا يمكن بدء الجولة إلا عند اكتمال العدد المحدد.</p>
          </section>}
          <button
            onClick={() => void copyInviteLink()}
            className="mx-auto mb-4 flex items-center gap-1.5 rounded-sm border-2 border-amber-800 bg-gradient-to-b from-amber-700 to-amber-900 px-3 py-1.5 font-mono text-[11px] font-black text-amber-100 shadow-[3px_3px_0_#000] transition hover:-translate-y-0.5 hover:border-amber-400 hover:brightness-110 hover:shadow-[3px_4px_0_#000,0_0_14px_rgba(245,158,11,0.3)]"
          >
            {inviteCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" /> لينك الدعوة اتنسخ!
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
                className="flex flex-1 items-center justify-center gap-2 rounded-sm border-2 border-amber-800 bg-[#6b4f1d] px-4 py-2.5 text-sm font-black text-amber-100 shadow-[3px_3px_0_#000] transition enabled:hover:-translate-y-0.5 enabled:hover:border-amber-400 enabled:hover:bg-amber-700 disabled:opacity-40"
              >
                <UserPlus className="h-4 w-4" />
                ضيف بوت
              </button>
              <button
                onClick={() => onAddBot(neededForFull)}
                disabled={neededForFull <= 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-sm border-2 border-stone-600 bg-stone-800 px-4 py-2.5 text-sm font-black text-stone-200 shadow-[3px_3px_0_#000] transition enabled:hover:-translate-y-0.5 enabled:hover:border-amber-600 enabled:hover:text-amber-300 disabled:opacity-40"
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
              className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-black bg-gradient-to-b from-red-700 via-red-800 to-red-950 px-6 py-4 font-serif text-lg font-black tracking-wide text-amber-50 shadow-[5px_5px_0_#000] transition enabled:hover:border-amber-500 enabled:hover:brightness-110 enabled:hover:shadow-[5px_5px_0_#000,0_0_22px_rgba(245,158,11,0.45)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-5 w-5" />
              يلا نبدأ اللعب
            </motion.button>
          ) : (
            <p className="text-center font-mono text-sm italic text-stone-500">
              مستنيين صاحب الأوضة يبدأ الليل...
            </p>
          )}
          {!isHost || !canStart ? (
            <p className="mt-3 text-center font-mono text-xs text-stone-600">
              الأدوار هتتوزع بالسر لما تبدأ اللعبة.
            </p>
          ) : null}
        </div>
        </motion.div>
      </div>
    </div>
  );
}

function SettingNumber({ label, value, min, max, disabled, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-stone-400">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))}
        className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-amber-200 disabled:opacity-60"
      />
    </label>
  );
}
