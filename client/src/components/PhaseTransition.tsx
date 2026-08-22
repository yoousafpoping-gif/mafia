'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Phase } from '@/lib/types';

const LABELS: Partial<Record<Phase, { title: string; sub: string; night: boolean }>> = {
  NIGHT: { title: 'الليل بييجي..', sub: 'اقفل عينك وافتح ودنك', night: true },
  DAY_DISCUSSION: { title: 'الصبح طلع!', sub: 'البلد صحت.. مين اللي مشي؟', night: false },
  DAY_VOTING: { title: 'المحاكمة بدأت', sub: 'صوتك سلاح.. استخدمه صح', night: false },
  DEFENSE_STAGE: { title: 'منصة الدفاع!', sub: 'المتهم بيدافع.. والتصويت لسه بيتحرك', night: false },
  LAST_WORDS: { title: 'آخر كلام..', sub: 'المتهم واقف على المنصة', night: false },
  GAME_OVER: { title: 'انتهت اللعبة', sub: 'الحكم اتلفظ', night: false },
};

export function PhaseTransition({ phase, round }: { phase: Phase; round: number }) {
  const [visible, setVisible] = useState(true);
  const info = LABELS[phase];

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1700);
    return () => clearTimeout(timer);
  }, []);

  if (!info) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${phase}-${round}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center"
        >
          <div
            className="absolute inset-0"
            style={{
              background: info.night
                ? 'radial-gradient(ellipse at center, rgba(2,4,12,0.55) 30%, rgba(0,0,0,0.92) 100%)'
                : 'radial-gradient(ellipse at center, rgba(20,14,4,0.4) 25%, rgba(0,0,0,0.88) 100%)',
            }}
          />
          <motion.div
            initial={{ scale: 0.85, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 1.06, opacity: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative text-center"
          >
            <h2
              className={`font-serif text-5xl font-black tracking-wide sm:text-6xl ${
                info.night ? 'text-slate-200' : 'text-gold-300'
              }`}
              style={{ textShadow: info.night ? '0 0 40px rgba(148,163,255,0.45), 0 2px 4px rgba(0,0,0,0.9)' : '0 0 40px rgba(229,181,103,0.55), 0 2px 4px rgba(0,0,0,0.9)' }}
            >
              {info.title}
            </h2>
            <p className="mt-3 text-sm font-semibold tracking-[0.3em] text-slate-400 uppercase">
              {info.sub}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
