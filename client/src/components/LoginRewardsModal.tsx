'use client';

import { Coins, Frame, Gem, Gift, Image as ImageIcon, LockKeyhole, X } from 'lucide-react';
import { LOGIN_REWARD_CALENDAR, loginRewardLabel } from '@/lib/loginRewardsConfig';

export function LoginRewardsModal({ open, claimedDays, busy, message, onClose, onClaim }: {
  open: boolean;
  claimedDays: number[];
  busy: boolean;
  message: string;
  onClose: () => void;
  onClaim: (day: number) => void;
}) {
  if (!open) return null;
  const today = Math.min(30, new Date().getUTCDate());
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/85 p-0 backdrop-blur-sm sm:items-center sm:p-4" dir="rtl">
      <section className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-gold-500/35 bg-[#090b12] p-4 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/15 text-gold-300"><Gift /></span><div><h2 className="text-xl font-black text-white">مكافآت تسجيل الدخول</h2><p className="text-xs text-slate-400">افتح اللعبة كل يوم وخد جائزة الشهر</p></div></div>
          <button onClick={onClose} className="rounded-xl border border-white/10 p-2 text-slate-300"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
          {LOGIN_REWARD_CALENDAR.map(({ day, reward }) => {
            const claimed = claimedDays.includes(day);
            const current = day === today;
            const locked = day > today;
            const Icon = reward.type === 'coins' ? Coins : reward.type === 'gems' ? Gem : reward.category === 'cardFrame' ? Frame : ImageIcon;
            return <button key={day} disabled={!current || claimed || busy} onClick={() => onClaim(day)} className={`relative min-h-28 rounded-2xl border p-2 text-center transition ${claimed ? 'border-emerald-500/35 bg-emerald-500/10' : current ? 'border-gold-400 bg-gold-500/15 shadow-[0_0_24px_rgba(229,181,103,.2)]' : 'border-white/10 bg-white/[.035]'} disabled:cursor-default`}>
              <span className="absolute right-2 top-2 text-[10px] font-black text-slate-400">يوم {day}</span>
              <Icon className={`mx-auto mt-5 h-7 w-7 ${reward.type === 'gems' ? 'text-cyan-300' : 'text-gold-300'}`} />
              <span className="mt-2 block text-[10px] font-bold leading-4 text-slate-200">{loginRewardLabel(reward)}</span>
              <span className={`mt-1 block text-[9px] font-black ${claimed ? 'text-emerald-300' : current ? 'text-gold-200' : 'text-slate-600'}`}>{claimed ? 'مستلمة ✓' : current ? 'متاحة الآن' : locked ? 'مغلقة' : 'فاتت'}</span>
              {locked && <LockKeyhole className="absolute left-2 top-2 h-3 w-3 text-slate-600" />}
            </button>;
          })}
        </div>
        {message && <p className="mt-4 text-center text-sm font-bold text-gold-200">{message}</p>}
      </section>
    </div>
  );
}
