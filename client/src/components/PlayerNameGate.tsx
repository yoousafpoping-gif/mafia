'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { GAME_LOGO, GAME_TITLE } from '@/lib/branding';
import { validatePlayerName } from '@/lib/playerName';

export function PlayerNameGate({ initialName = '', onSubmit }: {
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const result = validatePlayerName(name);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(result.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'مقدرناش نحفظ الاسم — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir="rtl" className="custom-scrollbar relative h-dvh w-full overflow-y-auto overflow-x-hidden bg-[#05060a] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/backgrounds/main_bg.jpeg')" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/70 backdrop-brightness-50" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.18),transparent_34%),radial-gradient(circle_at_80%_90%,rgba(193,18,31,0.2),transparent_38%)]" />
      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-8">
        <motion.section initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-md rounded-3xl border border-gold-500/35 bg-black/65 p-6 text-center shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_35px_rgba(212,175,55,0.12)] backdrop-blur-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GAME_LOGO} alt={GAME_TITLE} className="mx-auto h-24 w-24 object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.45)]" />
          <UserRound className="mx-auto mt-2 h-8 w-8 text-gold-300" />
          <h1 className="mt-3 font-serif text-2xl font-black text-gold-100">اختار اسمك في الحارة</h1>
          <p className="mt-2 text-xs leading-6 text-slate-400">الاسم ده هيظهر في الغرف واللعبة. تقدر تغيّره لاحقًا من حسابك.</p>
          <label className="mt-5 block text-right">
            <span className="mb-1.5 block text-xs font-bold text-slate-300">اسم اللاعب</span>
            <input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(''); }} onKeyDown={(event) => event.key === 'Enter' && void submit()} maxLength={16} disabled={busy} placeholder="مثال: يوسف أو Youssef" className="w-full rounded-xl border border-night-600 bg-night-900/90 px-4 py-3 text-center text-base font-bold text-slate-100 placeholder-slate-600 outline-none transition focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20" />
          </label>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">من 2 إلى 16 حرفًا · عربي أو لاتيني · بدون رموز أو مسافات متكررة</p>
          {error && <p role="alert" className="mt-3 rounded-xl border border-blood-500/45 bg-blood-900/35 px-3 py-2 text-xs font-bold text-blood-200">{error}</p>}
          <motion.button whileTap={!busy ? { scale: 0.98 } : undefined} type="button" onClick={() => void submit()} disabled={busy} className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-gold-400/70 bg-gradient-to-l from-blood-800 via-blood-700 to-blood-600 px-4 font-black text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5 text-gold-300" />}
            {busy ? 'بنحفظ هويتك...' : 'ثبّت الاسم وادخل الحارة'}
          </motion.button>
        </motion.section>
      </div>
    </main>
  );
}
