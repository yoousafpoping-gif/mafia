'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Crown, Skull, Users, X } from 'lucide-react';
import { RolePortrait } from './RoleCard';
import { ROLE_META } from '@/lib/roles';
import { METAL_HEADER } from '@/styles/themeConfig';
import type { Role } from '@/lib/types';

const FLOW = [
  {
    title: 'توزيع الأدوار',
    text: 'كل واحد بيسحب كرت في السر: مافيا أو أهالي. عدّ المافيا بيكون حوالي ثلث اللعيبة.',
  },
  {
    title: 'الليل',
    text: 'البلد بت نام! المافيا بتختار ضحية، الدكتور بيحمي حد، والقناص ممكن يطلق رصاصه.',
  },
  {
    title: 'أخبار الصبح',
    text: 'بنصحي نشوف مين اللي مشي في الليل.. ولو محدش مشيش يبقى الليلة كانت هادية.',
  },
  {
    title: 'النقاش',
    text: 'الكلام حر! اتهم، دافع، خمّن.. بس خد بالك إن المافيا بتتكلم زي الأهالي بالظبط.',
  },
  {
    title: 'المحاكمة',
    text: 'بيتصوت على أكتر حد مشبوه. اللي ياخد أكتر صوت بيتعدم وبنكشف دوره على طول.',
  },
];

const WIN_CONDITIONS = [
  { icon: Users, text: 'الأهالي يكسبوا لما كل عيلة المافيا تتمشن.' },
  { icon: Skull, text: 'المافيا تكسب لما عددُها يبقى بيساوي عدد الأهالي.' },
];

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'flow' | 'roles'>('flow');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-night-950/80 p-3 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="leather-bg flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gold-500/40 shadow-[0_0_20px_rgba(230,57,70,0.15),0_0_60px_rgba(0,0,0,0.8)]"
          >
            <header className="flex items-center justify-between border-b border-gold-500/20 px-4 py-3">
              <h2 className={`${METAL_HEADER} flex items-center gap-2 text-lg`}>
                <BookOpen className="h-5 w-5" />
                دفتر القوانين
              </h2>
              <button
                onClick={onClose}
                className="btn-noir flex h-8 w-8 items-center justify-center rounded-full border border-night-600 bg-night-800 text-slate-400 transition hover:scale-105 hover:border-blood-500/60 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex gap-1 border-b border-night-600/50 px-3 pt-2">
              {(
                [
                  ['flow', 'إزاي تلعب'],
                  ['roles', 'الأدوار والمهام'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-t-lg px-3 py-1.5 text-sm font-bold transition ${
                    tab === key
                      ? 'border-x border-t border-gold-500/50 bg-night-900/80 text-gold-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {tab === 'flow' ? (
                <>
                  <ol className="space-y-2.5">
                    {FLOW.map((step, i) => (
                      <motion.li
                        key={step.title}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex gap-3 rounded-xl border border-night-600/60 bg-night-900/70 p-3"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-500/50 bg-gold-500/10 font-serif text-xs font-black text-gold-300">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-100">{step.title}</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">
                            {step.text}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                  <div className="rounded-xl border border-gold-500/30 bg-gold-600/10 p-3">
                    <p className="mb-1.5 font-mono text-[10px] tracking-[0.25em] text-gold-400 uppercase">
                      مين يكسب؟
                    </p>
                    <ul className="space-y-1.5">
                      {WIN_CONDITIONS.map((condition) => (
                        <li key={condition.text} className="flex items-start gap-2 text-[13px] text-slate-200">
                          <condition.icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                          {condition.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="space-y-2.5">
                  {(Object.keys(ROLE_META) as Role[]).map((roleKey, i) => {
                    const meta = ROLE_META[roleKey];
                    const mafia = meta.team === 'MAFIA';
                    return (
                      <motion.div
                        key={roleKey}
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex gap-3 rounded-xl border p-3 ${
                          mafia
                            ? 'border-blood-500/35 bg-blood-700/10'
                            : 'border-gold-500/30 bg-gold-600/5'
                        }`}
                      >
                        <span className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-night-600/70 shadow-inner">
                          <RolePortrait role={roleKey} />
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className={`font-serif text-base font-black ${mafia ? 'text-blood-300' : 'text-gold-300'}`}>
                              {meta.label}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-px text-[9px] font-black ${
                                mafia
                                  ? 'border-blood-500/50 bg-blood-600/20 text-blood-300'
                                  : 'border-gold-500/50 bg-gold-500/15 text-gold-300'
                              }`}
                            >
                              {mafia ? 'مافيا' : 'أهالي'}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs italic text-slate-500">{meta.tagline}</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-slate-300">
                            <span className={`font-bold ${mafia ? 'text-blood-400' : 'text-gold-400'}`}>
                              مهمته:{' '}
                            </span>
                            {meta.abilityText}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                  <p className="flex items-start gap-2 rounded-xl border border-night-600/60 bg-night-900/70 p-3 text-[13px] text-slate-400">
                    <Crown className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                    فاكر إن العمدة لما يكشف نفسه صوته بيتحسب ×3 في المحاكمة!
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
