'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, HeartHandshake, Timer } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';
import type { RevengePrompt } from '@/lib/types';

export function RevengeModal({
  prompt,
  deadline,
  onSubmit,
}: {
  prompt: RevengePrompt | null;
  deadline: number | null;
  onSubmit: (targetId: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const secondsLeft = useCountdown(deadline ?? prompt?.deadline ?? null);

  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl border border-blood-500/50 bg-gradient-to-b from-[#1a0b10] to-night-950 p-6 shadow-[0_0_80px_rgba(220,38,38,0.35)]"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: [0, -6, 6, 0] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
              >
                <HeartHandshake className="mx-auto h-10 w-10 text-blood-400" />
              </motion.div>
              <h2 className="text-glow-blood mt-3 font-serif text-2xl font-black text-white">
                إنت اللي مشيت النهارده..
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                بس عندك حق تنزل حد معاك. اختار مين هيمشي معاك في الضلمة.
              </p>
              {secondsLeft !== null && (
                <p className="mt-2 flex items-center justify-center gap-1.5 font-mono text-xs text-blood-400">
                  <Timer className="h-3 w-3" /> فاضل {secondsLeft}ث تفكر
                </p>
              )}
            </div>

            <div className="mt-5 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {prompt.options.map((option) => (
                <motion.button
                  key={option.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelected(option.id === selected ? null : option.id)}
                  className={`truncate rounded-xl border px-3 py-2.5 text-sm transition ${
                    option.id === selected
                      ? 'border-blood-500 bg-blood-600/30 text-white'
                      : 'border-night-600 bg-night-800/80 text-slate-300 hover:border-blood-500/50'
                  }`}
                >
                  {option.name}
                </motion.button>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={() => {
                  onSubmit(selected);
                  setSelected(null);
                }}
                disabled={!selected}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blood-700 to-blood-500 py-3 font-bold text-white shadow-lg transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Flame className="h-4 w-4" />
                يلا.. هو معايا
              </button>
              <button
                onClick={() => onSubmit(null)}
                className="w-full rounded-xl border border-night-600 py-2.5 text-sm text-slate-400 transition hover:text-slate-200"
              >
                لا، هموت بالراحة
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
