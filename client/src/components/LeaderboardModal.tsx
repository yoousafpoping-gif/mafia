'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Crown, Loader2, Trophy, X } from 'lucide-react';
import { SERVER_URL } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';

interface LeaderRow {
  uid: string;
  displayName: string;
  photoURL: string;
  rank: string;
  coins: number;
  wins: number;
  totalGames: number;
  weeklyWins: number;
  weeklyGames: number;
}

/** لوحة صدارة الأسبوع — أعلى 10 بالانتخابات الأسبوعية ونسبة الفوز */
export function LeaderboardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [weekKey, setWeekKey] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // تصفير الحالة القديمة مؤجّل — setState مباشر جوه الإفكت بيعمل cascading renders
    const reset = window.setTimeout(() => {
      if (cancelled) return;
      setRows(null);
      setFailed(false);
    }, 0);
    fetch(`${SERVER_URL}/api/leaderboard`)
      .then((res) => {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then((data: { weekKey: string; players: LeaderRow[] }) => {
        if (cancelled) return;
        setRows(data.players);
        setWeekKey(data.weekKey ?? '');
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(reset);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-night-950/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="لوحة الصدارة الأسبوعية"
            className="max-h-[86vh] w-[92%] max-w-md overflow-hidden rounded-2xl border border-gold-500/45 bg-gradient-to-b from-night-900 to-night-950 shadow-[0_0_70px_rgba(229,181,103,0.22)]"
          >
            {/* header */}
            <div className="relative border-b border-gold-500/25 bg-gradient-to-b from-gold-500/12 to-transparent px-4 py-3.5">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 mx-auto h-16 w-2/3 rounded-full bg-gold-500/20 blur-2xl"
              />
              <div className="relative flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-serif text-lg font-black text-gold-200">
                  <Trophy className="h-5 w-5 text-gold-400 drop-shadow-[0_0_10px_rgba(229,181,103,0.7)]" />
                  لوحة صدارة الأسبوع
                </h3>
                <button
                  onClick={onClose}
                  aria-label="اقفل"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-night-600 bg-night-800 text-slate-400 transition hover:text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {weekKey && (
                <p className="relative mt-0.5 pr-7 font-mono text-[9px] tracking-[0.3em] text-slate-500 uppercase">
                  week {weekKey} · بتتصفّر كل أسبوع
                </p>
              )}
            </div>

            {/* body */}
            <div className="custom-scrollbar max-h-[62vh] overflow-y-auto p-3">
              {rows === null && !failed && (
                <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
                  <p className="text-xs">بنجيب الأسماء الكبيرة...</p>
                </div>
              )}
              {failed && (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-400">الصدارة مش متاحة دلوقتي — جرّب تاني.</p>
                </div>
              )}
              {rows !== null && rows.length === 0 && (
                <div className="py-10 text-center">
                  <Trophy className="mx-auto h-8 w-8 text-slate-700" />
                  <p className="mt-2 text-sm text-slate-400">لسه محدش لعّب الأسبوع ده.. كن أول واحد!</p>
                </div>
              )}
              {rows !== null && rows.length > 0 && (
                <ol className="space-y-1.5">
                  {rows.map((row, index) => {
                    const winRate = row.totalGames > 0 ? Math.round((row.wins / row.totalGames) * 100) : 0;
                    const you = user?.uid === row.uid;
                    const medal = index === 0 ? 'from-yellow-300 to-amber-600' : index === 1 ? 'from-slate-200 to-slate-500' : index === 2 ? 'from-amber-600 to-amber-900' : 'from-night-700 to-night-800';
                    return (
                      <motion.li
                        key={row.uid}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                          you
                            ? 'border-gold-400/70 bg-gold-500/10 shadow-[0_0_18px_rgba(229,181,103,0.25)]'
                            : 'border-white/[0.06] bg-white/[0.03]'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b font-mono text-[11px] font-black text-night-950 ${medal}`}
                        >
                          {index < 3 ? <Crown className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        {/* avatar */}
                        {row.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.photoURL}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-8 w-8 shrink-0 rounded-full border border-gold-500/40 object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-night-950 font-serif text-xs font-black text-gold-200">
                            {row.displayName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 truncate text-sm font-bold text-slate-100">
                            {row.displayName}
                            {you && <span className="text-[10px] text-gold-400">(إنت)</span>}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                            <span>{row.rank}</span>
                            <span className="flex items-center gap-0.5 text-gold-500/80">
                              <Coins className="h-3 w-3" /> {row.coins}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-left">
                          <span className="block font-mono text-sm font-black text-gold-300">
                            {row.weeklyWins}فوز
                          </span>
                          <span className="block font-mono text-[9px] text-slate-500">
                            نسبة {winRate}% · {row.totalGames} لعبة
                          </span>
                        </span>
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </div>

            <p className="border-t border-gold-500/20 bg-black/30 px-4 py-2 text-center text-[10px] text-slate-500">
              الترتيب: انتصارات الأسبوع ← نسبة الفوز — فوز = 100 كوينز، لعبة = 25
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
