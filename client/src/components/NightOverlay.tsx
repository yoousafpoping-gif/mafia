'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, LogOut, Moon, SkipForward, Skull, Timer } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import { GOLD_ICON } from '@/styles/themeConfig';
import { RoleAvatar } from './Avatars';
import { MicButton } from './MicButton';
import { ABILITY_LABEL, ROLE_META } from '@/lib/roles';
import type { ActionRequest, GameState, VoicePolicy } from '@/lib/types';
import type { VoiceController } from '@/hooks/useVoiceChat';

export function NightOverlay({
  state,
  actionRequest,
  voicePolicy,
  voice,
  onLeave,
  onSubmitAbility,
}: {
  state: GameState;
  actionRequest: ActionRequest | null;
  voicePolicy: VoicePolicy | null;
  voice: VoiceController;
  onLeave: () => void;
  onSubmitAbility: (targetId: string | null) => void;
}) {
  const you = state.you!;
  const [selected, setSelected] = useState<string | null>(null);
  const secondsLeft = useCountdown(state.deadline);

  const meta = you.role ? ROLE_META[you.role] : null;
  const isActor = Boolean(actionRequest && !you.hasSubmittedNightAction);
  const awaitingOthers = Boolean(you.ability) && you.hasSubmittedNightAction;

  const confirm = () => {
    if (!actionRequest) return;
    onSubmitAbility(selected);
    setSelected(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="starfield fixed inset-0 z-40 flex flex-col items-center overflow-y-auto bg-gradient-to-b from-[#050814] via-[#0a0f24] to-black px-4 pb-8 pt-4"
    >
      {/* التوب بار بيتشال وقت الليل — الشاشة كلها لليل، والضروريات هنا */}
      <div className="flex w-full items-center justify-between">
        <button
          onClick={onLeave}
          title="اطلع من الأوضة"
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/25 bg-black/40 ${GOLD_ICON}`}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-2 py-1 font-mono text-[10px] font-black tracking-widest text-gold-300">
          {state.code}
        </span>
        <MicButton voice={voice} />
      </div>

      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mt-6 flex items-center gap-3"
      >
        <Moon className="h-9 w-9 text-gold-400" />
        <div>
          <h2 className="font-serif text-3xl font-black tracking-wide text-slate-100">
            الليلة <span className="text-metallic-gold">رقم {state.round}</span>
          </h2>
          <p className="text-xs font-bold tracking-[0.3em] text-slate-500 uppercase">
            البلد نامت خلاص
          </p>
        </div>
      </motion.div>

      {secondsLeft !== null && (
        <p
          className={`mt-4 flex items-center gap-1.5 rounded-full border px-4 py-1 font-mono text-sm tabular-nums ${
            secondsLeft <= 5
              ? 'border-blood-500/50 text-blood-400'
              : 'border-night-600 text-slate-400'
          }`}
        >
          <Timer className="h-3.5 w-3.5" /> فاضل {secondsLeft}ث على الفجر
        </p>
      )}

      <AnimatePresence mode="wait">
        {isActor && actionRequest && meta ? (
          <motion.div
            key="act"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="glass-panel mt-8 w-full max-w-lg rounded-2xl bg-night-850/80 p-6"
          >
            <div className="mb-5 text-center">
              <div className="mx-auto w-fit">
                <RoleAvatar role={you.role!} size={52} />
              </div>
              <h3 className="mt-2 font-serif text-xl font-black text-slate-100">
                {ABILITY_LABEL[actionRequest.ability]} &mdash; مين يعني؟
              </h3>
              {actionRequest.ability === 'SHOOT' && (
                <p className="mt-1 text-xs text-blood-400">
                  باقي معاك {you.bulletsLeft} رصاصة · لو أصبت بريء هتموت معاه
                </p>
              )}
              {actionRequest.ability === 'SAVE' && (
                <p className="mt-1 text-xs text-slate-500">
                  تنفع تحمي نفسك كمان الليلة دي.
                </p>
              )}
            </div>

            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {actionRequest.options.map((option) => {
                const isSelected = selected === option.id;
                const isBot = state.players.find((p) => p.id === option.id)?.isBot;
                return (
                  <motion.button
                    key={option.id}
                    layout
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSelected(isSelected ? null : option.id)}
                    className={`truncate rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      isSelected
                        ? 'border-blood-500 bg-blood-600/25 text-white shadow-[0_0_20px_rgba(220,38,38,0.35)]'
                        : 'border-night-600 bg-night-800/70 text-slate-300 hover:border-gold-500/50 hover:shadow-[0_0_14px_rgba(229,181,103,0.25)]'
                    }`}
                  >
                    {option.name}
                    {isBot && <span className="ml-1 text-[10px]">🤖</span>}
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={confirm}
                disabled={!selected}
                className="flex flex-1 transform-gpu items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-700 to-blood-600 py-3 font-semibold text-white shadow-lg transition-all duration-200 enabled:hover:scale-[1.03] enabled:hover:brightness-110 enabled:hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                اتفضل.. قررت
              </button>
              {actionRequest.allowsSkip && (
                <button
                  onClick={() => onSubmitAbility(null)}
                  className="flex transform-gpu items-center justify-center gap-2 rounded-xl border border-night-600 bg-night-800 px-4 py-3 text-sm text-slate-400 transition-all duration-200 enabled:hover:scale-[1.03] enabled:hover:border-gold-500/50 enabled:hover:text-gold-300"
                >
                  <SkipForward className="h-4 w-4" />
                  مش هحرك النهارده
                </button>
              )}
            </div>
          </motion.div>
        ) : awaitingOthers ? (
          <motion.div key="sealed" initial={{opacity:0}} animate={{opacity:1}} className="mt-12 text-center">
            <Check className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-3 text-slate-300">حركتك اتقفلت خلاص.</p>
            <p className="mt-1 text-sm text-slate-500">مستنيين باقي الليل يكمل...</p>
          </motion.div>
        ) : you.isAlive ? (
          <motion.div key="sleep" initial={{opacity:0}} animate={{opacity:1}} className="mt-12 text-center">
            <Moon className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 italic text-slate-400">إنت نايم الليلة دي.. نامت بالسلامة.</p>
            <p className="mt-1 text-sm text-slate-600">فتح ودانك كويس، ممكن تسمع خطوات.</p>
          </motion.div>
        ) : (
          <motion.div key="dead" initial={{opacity:0}} animate={{opacity:1}} className="mt-12 text-center">
            <Skull className="mx-auto h-8 w-8 text-slate-700" />
            <p className="mt-3 italic text-slate-500">الليل للأحياء بس يا صاحبي.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto pt-10 text-center text-xs text-slate-600">
        <p>
          فاضل {state.players.filter((player) => player.isAlive).length} أرواح
        </p>
        {voicePolicy?.channel === 'MAFIA' && (
          <p className="mt-1 text-blood-400">
            خط العيلة مفتوح — مفيش غير أهل بيتك اللي بيسمعوك.
          </p>
        )}
        {voicePolicy?.channel === 'MUTED' && (
          <p className="mt-1 italic">كل الخطوط مقفولة لحد الفجر.</p>
        )}
      </div>
    </motion.div>
  );
}
