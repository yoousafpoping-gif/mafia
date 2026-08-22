'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MoonStar } from 'lucide-react';
import { RoleAvatar } from './Avatars';
import { ROLE_META } from '@/lib/roles';
import type { NightResultPayload } from '@/lib/types';

export function MorningReport({
  nightResult,
  round,
}: {
  nightResult: NightResultPayload | null;
  round: number;
}) {
  // الصوت (ورق + طلقة) ملك لتريجر الجريدة في GameClient — هنا كارت HUD بس.

  return (
    <AnimatePresence>
      {nightResult && (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-panel overflow-hidden rounded-2xl bg-gradient-to-b from-night-850/80 to-night-900/90"
        >
          <div className="p-5">
            <h3 className="flex items-center gap-2 font-serif text-lg font-black text-slate-100">
              <MoonStar className="h-5 w-5 text-gold-400" />
              أخبار الصبح — بعد الليلة رقم {nightResult.round}
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
              {nightResult.events.map((event, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500/80" />
                  {event.text}
                </li>
              ))}
            </ul>
            {nightResult.deaths.length > 0 ? (
              <div className="mt-4 space-y-2">
                {nightResult.deaths.map((death) => (
                  <div
                    key={death.id}
                    className="flex items-center gap-3 rounded-xl border border-blood-500/30 bg-blood-600/10 px-4 py-2.5"
                  >
                    <RoleAvatar role={death.role} size={36} />
                    <span className="text-sm font-bold text-slate-100">{death.name}</span>
                    <span
                      className={`text-xs font-bold ${
                        ROLE_META[death.role]?.team === 'MAFIA' ? 'text-blood-400' : 'text-gold-500'
                      }`}
                    >
                      كان {ROLE_META[death.role]?.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm italic text-emerald-400">
                كلهم صحوا بالسلامة! يلا بينا في الجولة {round}.
              </p>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
