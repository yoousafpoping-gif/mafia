'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROLE_META } from '@/lib/roles';
import type { Role } from '@/lib/types';

export interface EliminationInfo {
  playerId: string;
  name: string;
  role: Role;
}

/** خبر عاجل بيقفل لوحده بعد ٤ ثواني عشان اللعبة تكمل على طول */
const NEWS_FLASH_MS = 4000;

/**
 * جريدة الخبر العاجل — بتظهر بعد مشهد الإعدام مباشرةً.
 * العنوان بيتحدد من دور المُعدَم الحقيقي (مافيا / مواطن / دور خاص).
 */
export function NewsFlashModal({
  open,
  elimination,
  onClose,
}: {
  open: boolean;
  elimination: EliminationInfo | null | undefined;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(onClose, NEWS_FLASH_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const headline = (() => {
    if (!elimination) return null;
    const meta = ROLE_META[elimination.role];
    if (meta.team === 'MAFIA') {
      return `خبر عاجل: سقوط الشيطان! تم القضاء على ${elimination.name} واتضح أنه من المافيا!`;
    }
    if (elimination.role === 'CITIZEN') {
      return `خبر عاجل: إعدام مظلوم! تم إعدام ${elimination.name} وتبين أنه مواطن بيق!`;
    }
    // دور خاص في فريق الأهالي — نذكر الدور بالاسم
    return `خبر عاجل: إعدام مظلوم! تم إعدام ${elimination.name} واتضح أنه ${meta.label}!`;
  })();

  return (
    <AnimatePresence>
      {open && elimination && headline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 p-4"
          onClick={onClose}
        >
          <div className="animate-newspaper-spin w-[min(92vw,420px)] -rotate-2 cursor-pointer rounded-sm border border-[#b8ad93] bg-[#e8e0ce] p-5 text-night-950 shadow-[0_25px_80px_rgba(0,0,0,0.95)] sm:p-6">
            {/* masthead */}
            <div className="flex items-baseline justify-between border-b-2 border-night-950/80 pb-1.5">
              <span className="font-serif text-xl font-black tracking-tight sm:text-2xl">جريدة حارة المافيا اليومية</span>
              <span className="font-mono text-[9px] font-bold uppercase opacity-70">
                extra · round flash
              </span>
            </div>
            <div className="flex items-center justify-between py-1 font-mono text-[9px] opacity-70">
              <span>عدد خاص — توزيع مجاني</span>
              <span>سعر النسخة: قرشين</span>
            </div>

            <h2 className="mt-2 border-y border-night-950/30 py-2 text-center font-serif text-lg font-black leading-snug sm:text-xl">
              {headline}
            </h2>

            <p className="mt-3 text-center text-[11px] italic leading-relaxed opacity-75">
              شهود العيان يقولون إن المنصة اتنفضت لما اتقرا الحكم.. والمدينة صحيحة الصباح على خبر جديد.
            </p>

            <div className="mt-3 flex items-center justify-between border-t-2 border-dashed border-night-950/40 pt-2">
              <span className="font-mono text-[9px] opacity-60">اضغط في أي مكان للإغلاق</span>
              <span className="font-mono text-[9px] font-bold opacity-60">٤ ثواني والجريدة تتقفل</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
