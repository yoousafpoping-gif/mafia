'use client';

import { Coins, Gem, Gift, Settings, ShoppingBag, UserRound } from 'lucide-react';
import type { AuthUser, PlayerProfile } from '@/context/AuthContext';
import { levelProgress } from '@/lib/progressionConfig';

export function HomeTopBar({ user, profile, onRewards, onStore, onSettings }: {
  user: AuthUser | null;
  profile: PlayerProfile | null;
  onRewards: () => void;
  onStore: () => void;
  onSettings: () => void;
}) {
  const progress = levelProgress(profile?.stats.xp ?? 0);
  return <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/65 px-3 py-2 backdrop-blur-xl" dir="rtl">
    <div className="mx-auto flex max-w-7xl items-center gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-gold-400/40 bg-night-800 text-gold-300">
          {user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5" />}
        </div>
        <div className="min-w-0"><p className="truncate text-sm font-black text-white">{profile?.playerName || user?.displayName || 'اللاعب'}</p><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-gold-300">مستوى {progress.level}</span><div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10 sm:w-28" title={`${progress.xpIntoLevel} / ${progress.xpForNextLevel} XP`}><div className="h-full bg-gradient-to-l from-gold-500 to-amber-200" style={{ width: `${progress.percent}%` }} /></div><span className="hidden text-[9px] text-slate-400 sm:inline">{progress.xpIntoLevel}/{progress.xpForNextLevel} XP</span></div></div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onStore} className="flex h-9 items-center gap-1 rounded-xl border border-gold-500/25 bg-gold-500/10 px-2 text-xs font-black text-gold-200"><Coins className="h-4 w-4" />{profile?.coins ?? 0}</button>
        <button onClick={onStore} className="flex h-9 items-center gap-1 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-2 text-xs font-black text-cyan-200"><Gem className="h-4 w-4" />{profile?.gems ?? 0}</button>
        <button onClick={onRewards} aria-label="مكافآت الدخول" className="relative grid h-9 w-9 place-items-center rounded-xl border border-gold-400/40 bg-gold-500/15 text-gold-200"><Gift className="h-4 w-4" /><span className="absolute -left-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /></button>
        <button onClick={onStore} aria-label="المتجر" className="hidden h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 sm:grid"><ShoppingBag className="h-4 w-4" /></button>
        <button onClick={onSettings} aria-label="الإعدادات" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300"><Settings className="h-4 w-4" /></button>
      </div>
    </div>
  </header>;
}
