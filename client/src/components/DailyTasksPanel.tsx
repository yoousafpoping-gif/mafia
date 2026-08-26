'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Gift, ListChecks } from 'lucide-react';
import type { PlayerProfile } from '@/context/AuthContext';
import { DAILY_QUESTS } from '@/lib/progressionConfig';

const COLLAPSED_KEY = 'mafia-daily-tasks-collapsed';

export function DailyTasksPanel({ profile, busyKey, message, giftClaimable, giftCoins, giftGems, onGift, onQuest }: {
  profile: PlayerProfile;
  busyKey: string;
  message: string;
  giftClaimable: boolean;
  giftCoins: number;
  giftGems: number;
  onGift: () => void;
  onQuest: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(COLLAPSED_KEY) === '1');
  const toggle = () => setCollapsed((current) => {
    const next = !current;
    try { window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
    return next;
  });

  return <aside className={`w-full rounded-3xl border border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur-xl transition-[width] lg:fixed lg:left-6 lg:top-24 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto ${collapsed ? 'lg:w-20' : 'lg:w-80'}`} dir="rtl">
    <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex w-full items-center gap-3 rounded-2xl text-right focus-visible:outline-2 focus-visible:outline-gold-400">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-500/15 text-gold-300"><ListChecks className="h-6 w-6" /></span>
      {!collapsed && <div className="min-w-0 flex-1"><h2 className="text-lg font-black text-white">مهام اليوم</h2><p className="text-xs text-slate-400">تتجدد يوميًا</p></div>}
      {collapsed ? <ChevronDown className="h-6 w-6 shrink-0 text-gold-300 lg:-rotate-90" /> : <ChevronUp className="h-6 w-6 shrink-0 text-gold-300 lg:-rotate-90" />}
    </button>
    {!collapsed && <div className="mt-4">
      <button onClick={onGift} disabled={!giftClaimable || Boolean(busyKey)} className="mb-4 flex w-full items-center justify-between rounded-2xl border border-gold-500/25 bg-gold-500/10 p-3.5 text-right disabled:opacity-50"><span className="flex items-center gap-2 text-sm font-black text-gold-100"><Gift className="h-5 w-5" />هدية اليوم</span><span className="text-xs font-bold text-gold-300">{giftClaimable ? `${giftCoins} كوينز${giftGems ? ` + ${giftGems} جواهر` : ''}` : 'تم ✓'}</span></button>
      <div className="space-y-3">{DAILY_QUESTS.map((quest) => {
        const progress = profile.dailyQuests?.progress[quest.metric] ?? 0;
        const claimed = profile.dailyQuests?.claimed.includes(quest.id) ?? false;
        const complete = progress >= quest.target;
        const percent = Math.min(100, progress / quest.target * 100);
        return <article key={quest.id} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="text-sm font-black text-slate-100">{quest.title}</h3><p className="mt-1.5 text-xs leading-5 text-slate-400">{quest.description}</p><p className="mt-2 text-xs font-black text-gold-200">المكافأة: {quest.rewardXp} XP + {quest.rewardCoins} كوينز{quest.rewardGems ? ` + ${quest.rewardGems} جواهر` : ''}</p></div>{claimed && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}</div><div className="h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.min(progress, quest.target)} aria-valuemin={0} aria-valuemax={quest.target}><div className="h-full bg-gradient-to-l from-gold-500 to-amber-200 transition-[width]" style={{ width: `${percent}%` }} /></div><div className="mt-2.5 flex items-center justify-between text-xs"><span className="font-bold text-slate-300">التقدم: {Math.min(progress, quest.target)} / {quest.target}</span><button onClick={() => onQuest(quest.id)} disabled={!complete || claimed || Boolean(busyKey)} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 font-black text-emerald-300 disabled:text-slate-600">{claimed ? 'تم التحصيل' : complete ? 'حصّل المكافأة' : 'قيد التنفيذ'}</button></div></article>;
      })}</div>
      {message && <p className="mt-4 text-center text-xs font-bold text-gold-200">{message}</p>}
    </div>}
  </aside>;
}
