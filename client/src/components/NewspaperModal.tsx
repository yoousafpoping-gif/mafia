'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playSfx } from '@/lib/sfx';

/**
 * «اليوم السابع» — جريدة الصبح اللي بتترمي على الطاولة مع كل فجر.
 * بتقرأ نتيجة الليل (ضحية + مكتوم) وبتعرض السيناريو المناسب،
 * وتقفل لوحدها بعد ٧ ثواني أو بأي ضغطة. بتتركب من جديد كل جولة
 * فأنييميشن الدخول بيشتغل كل مرة.
 */
export const NEWSPAPER_MS = 7000;

export interface NightReport {
  victim: string | null;
  silenced: string | null;
}

export function NewspaperModal({
  report,
  round,
}: {
  report: NightReport | null;
  round: number;
}) {
  const [open, setOpen] = useState(true);

  // جرجر الورق لحظة الرمي + رفع الجرنة بعد ٧ ثواني.
  useEffect(() => {
    playSfx('paper');
    const timer = setTimeout(() => setOpen(false), NEWSPAPER_MS);
    return () => clearTimeout(timer);
  }, []);

  const victimName = report?.victim ?? null;
  const silencedName = report?.silenced ?? null;

  let headline: string;
  let subHeadline: string;
  if (victimName && silencedName) {
    headline = 'جريمة بشعة وكمامات إجبارية!';
    subHeadline = `المافيا خلصت على "${victimName}".. ومش بس كده، "${silencedName}" صحي لقى نفسه متكتف وممنوع من الكلام!`;
  } else if (victimName) {
    headline = 'الدم للركب في شوارع المدينة!';
    subHeadline = `المافيا بتخلص على "${victimName}" في ظروف غامضة، والشرطة بتحقق مع أهل البلد.`;
  } else if (silencedName) {
    headline = 'ليلة هادية.. بس مريبة!';
    subHeadline = `مفيش ولا نقطة دم نزلت، لكن المافيا حطت لزق على بوق "${silencedName}" وممنوع يفتح بقه النهاردة!`;
  } else {
    headline = 'ليلة بيضا.. الحي بيتنفس بسلام!';
    subHeadline =
      'الدكتور قام بواجبه ومفيش ضحايا، وكل الناس صحيت سليمة.. يا ترى الهدوء ده وراه إيه؟';
  }

  const issueNo = 1000 + (round || 1) * 7;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="custom-scrollbar fixed inset-0 z-[78] flex items-center justify-center overflow-y-auto bg-night-950/85 p-4 backdrop-blur-sm"
        >
          <motion.article
            dir="rtl"
            initial={{ scale: 0, rotate: -720, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            exit={{ scale: 1.15, rotate: 4, opacity: 0 }}
            transition={{ duration: 0.8, type: 'spring' }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-[min(94%,520px)] shrink-0 border-8 border-black bg-[#e2d5c4] p-5 text-[#1c1a17] shadow-[0_30px_80px_rgba(0,0,0,0.85)] sm:p-7"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {/* بقع قدمرة على الورق */}
            <span aria-hidden className="pointer-events-none absolute -left-3 -top-3 h-24 w-24 rounded-full bg-[#b09a76]/40 blur-xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-4 -right-2 h-28 w-28 rounded-full bg-[#8f7a55]/30 blur-xl" />

            {/* الترويسة */}
            <header className="border-y-4 border-black py-2 text-center">
              <p className="font-mono text-[10px] font-bold tracking-[0.2em]">
                النسخة المسائية - الجولة {round} - صباح اليوم · رقم {issueNo}
              </p>
              <h2 className="mt-1 font-serif text-4xl font-black tracking-tight sm:text-5xl">
                اليوم السابع
              </h2>
            </header>

            {/* العنوان الرئيسي */}
            <section className="mt-4 text-center">
              <h3 className="font-serif text-xl font-black leading-snug underline decoration-4 underline-offset-4 sm:text-2xl">
                {headline}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#3d3830] sm:text-base">
                {subHeadline}
              </p>
            </section>

            <footer className="mt-4 flex items-center justify-between border-t border-black/60 pt-2 font-mono text-[11px] font-bold text-[#4a443b]">
              <span>الثمن: حياتك</span>
              <span className="animate-pulse">اضغط في أي مكان عشان تكمل..</span>
            </footer>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
