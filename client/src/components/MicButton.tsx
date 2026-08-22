'use client';

import { motion } from 'framer-motion';
import { Loader2, Lock, Mic, MicOff, PhoneOff } from 'lucide-react';
import { GOLD_ICON } from '@/styles/themeConfig';
import type { VoiceController } from '@/hooks/useVoiceChat';

export function MicButton({ voice }: { voice: VoiceController }) {
  const { joined, status, micOn, micLocked, lockReason, toggleMic, join, leave } = voice;

  if (!joined) {
    return (
      <button
        onClick={() => void join()}
        disabled={status === 'connecting'}
        title="ادخل الصوت"
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/30 bg-black/40 ${GOLD_ICON}`}
      >
        {status === 'connecting' ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <MicOff className="h-4 w-4" strokeWidth={1.5} />
        )}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={toggleMic}
        title={micLocked ? (lockReason ?? 'الميك مقفول') : micOn ? 'اسكت الميك' : 'افتح الميك'}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition ${
          micLocked
            ? `border-slate-600 bg-night-800/80 ${GOLD_ICON} opacity-70`
            : micOn
              ? 'border-emerald-400/80 bg-emerald-500/15 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.5)]'
              : 'border-blood-500/70 bg-blood-600/15 text-blood-300 drop-shadow-[0_0_8px_rgba(220,38,38,0.35)]'
        }`}
      >
        {micOn && !micLocked && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border border-emerald-400/60"
            animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          />
        )}
        {micOn && !micLocked ? (
          <Mic className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <MicOff className="h-4 w-4" strokeWidth={1.5} />
        )}
        {micLocked && (
          <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-night-950">
            <Lock className="h-2.5 w-2.5 text-slate-400" strokeWidth={1.5} />
          </span>
        )}
      </motion.button>

      <button
        onClick={leave}
        title="اطلع من الصوت"
        className={`flex h-7 w-7 items-center justify-center rounded-full border border-gold-500/25 bg-black/40 ${GOLD_ICON}`}
      >
        <PhoneOff className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </span>
  );
}
