'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playSound } from '@/lib/audioManager';
import { RoleAvatar } from './Avatars';
import { ROLE_META } from '@/lib/roles';
import type { Role } from '@/lib/types';

/**
 * مشهد الإعدام السينمائي — أوفرلاي أسود بملء الشاشة:
 * سبوت أحمر على كارت اللاعب → اهتزاز + وميض طلقة (SFX) →
 * بعد ثانيتين الكارت بيتقلب ويكشف الدور الحقيقي → يقفل بعد ٥ ثواني.
 */

const GUNSHOT_AT = 1400;
const FLIP_AT = 2000;
const CLOSE_AT = 5000;

type Stage = 'spot' | 'shot' | 'reveal';

export function ExecutionOverlay({
  elimination,
  onClose,
}: {
  elimination: { playerId: string; name: string; role: string } | null;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>('spot');

  // المكون بيتتركب من جديد مع كل إعدام (شرطي الـ && في GameClient)
  // فمرحلة 'spot' الأولانية جاية من الـ useState نفسه.
  useEffect(() => {
    if (!elimination) return;

    const shotTimer = window.setTimeout(() => {
      setStage('shot');
      playSound('/assets/sounds/gunshot.mp3', 0.9);
    }, GUNSHOT_AT);
    const flipTimer = window.setTimeout(() => setStage('reveal'), FLIP_AT);
    const closeTimer = window.setTimeout(onClose, CLOSE_AT);

    return () => {
      window.clearTimeout(shotTimer);
      window.clearTimeout(flipTimer);
      window.clearTimeout(closeTimer);
    };
  }, [elimination, onClose]);

  const roleLabel = ROLE_META[elimination?.role as keyof typeof ROLE_META]?.label ?? '؟؟';

  return (
    <AnimatePresence>
      {elimination && (
        <motion.div
          key="execution"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black ${
            stage === 'shot' ? 'screen-shake' : ''
          }`}
        >
          {/* harsh red spotlight pulsing behind the card */}
          <motion.span
            aria-hidden
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="absolute h-[46vmin] w-[46vmin] rounded-full bg-[radial-gradient(circle,_rgba(230,57,70,0.55)_0%,_rgba(120,10,15,0.25)_45%,_transparent_70%)] blur-2xl"
          />

          {/* gunshot muzzle flash frame */}
          {stage !== 'spot' && (
            <span aria-hidden className="gunshot-flash pointer-events-none absolute inset-0 bg-white" />
          )}

          {/* the condemned card — flips to reveal the true role */}
          <div className="perspective-1200 relative z-10">
            <motion.div
              animate={stage === 'reveal' ? { rotateY: 180 } : { rotateY: 0 }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
              className="preserve-3d relative h-44 w-32 sm:h-52 sm:w-40"
            >
              {/* front — face-down card under the spotlight */}
              <div className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 border-blood-600/70 bg-gradient-to-b from-night-800 to-night-950 shadow-[0_0_60px_rgba(230,57,70,0.45)]">
                <span className="font-serif text-5xl font-black text-blood-500 drop-shadow-[0_0_18px_rgba(230,57,70,0.8)]">
                  ؟
                </span>
              </div>
              {/* back — the true role revealed */}
              <div
                className="backface-hidden absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-gold-500/70 bg-gradient-to-b from-night-850 to-night-950 p-3"
                style={{ transform: 'rotateY(180deg)' }}
              >
                <RoleAvatar role={elimination.role as Role} size={64} />
                <span className="text-center font-serif text-sm font-black leading-snug text-gold-300">
                  {roleLabel}
                </span>
              </div>
            </motion.div>
          </div>

          {/* dramatic narration */}
          <div className="relative z-10 mt-8 px-6 text-center">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="font-serif text-xl font-black text-slate-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-2xl"
            >
              تم إعدام <span className="text-blood-400">{elimination.name}</span> بقرار المجلس...
            </motion.p>
            <AnimatePresence>
              {stage === 'reveal' && (
                <motion.p
                  initial={{ opacity: 0, scale: 1.25 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                  className="mt-3 font-mono text-base font-bold tracking-wide text-gold-400 sm:text-lg"
                >
                  ...وكان {roleLabel}!
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
