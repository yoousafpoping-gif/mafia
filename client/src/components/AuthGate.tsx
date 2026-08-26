'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { GAME_LOGO, GAME_TITLE } from '@/lib/branding';
import { PlayerNameGate } from './PlayerNameGate';

const PUBLIC_ROUTES = ['/privacy'];

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    user,
    loading,
    authError,
    firebaseReady,
    signInWithGoogle,
    signInWithFacebook,
    continueAsGuest,
  } = useAuth();
  const [busy, setBusy] = useState<'google' | 'facebook' | 'guest' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authError) setError(authError.message);
  }, [authError]);

  if (PUBLIC_ROUTES.includes(pathname)) return children;

  const run = async (provider: 'google' | 'facebook' | 'guest') => {
    setBusy(provider);
    setError('');
    try {
      if (provider === 'google') await signInWithGoogle();
      else if (provider === 'facebook') await signInWithFacebook();
      else await continueAsGuest();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'الدخول فشل — جرّب تاني');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <AuthLoading />;
  if (user) return <PlayerNameGateBoundary>{children}</PlayerNameGateBoundary>;

  return (
    <main
      className="custom-scrollbar relative h-dvh w-full overflow-y-auto overflow-x-hidden bg-[#05060a] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/assets/backgrounds/main_bg.jpeg')" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/70 backdrop-brightness-50" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.18),transparent_34%),radial-gradient(circle_at_80%_90%,rgba(193,18,31,0.2),transparent_38%)]" />

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-8">
        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-gold-500/35 bg-black/65 p-5 text-center shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_35px_rgba(212,175,55,0.12)] backdrop-blur-xl sm:p-7"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={GAME_LOGO} alt={GAME_TITLE} className="mx-auto h-28 w-28 object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.45)]" />
          <h1 className="logo-bevel mt-2 font-serif text-4xl font-black">{GAME_TITLE}</h1>
          <p className="mt-2 text-xs font-bold tracking-[0.25em] text-slate-500">مجلس الظلام · لا تثق في حد</p>

          <div className="my-5 flex items-center gap-3 text-[10px] text-slate-600">
            <span className="h-px flex-1 bg-gradient-to-l from-gold-500/40 to-transparent" />
            اختار هويتك قبل دخول الحارة
            <span className="h-px flex-1 bg-gradient-to-r from-gold-500/40 to-transparent" />
          </div>

          <div className="space-y-2.5">
            <AuthButton
              label="الدخول بحساب Google"
              note="تقدمك ورصيدك محفوظين على كل أجهزتك"
              busy={busy === 'google'}
              disabled={busy !== null || !firebaseReady}
              icon={<GoogleMark />}
              onClick={() => void run('google')}
            />
            <AuthButton
              label="الدخول بحساب Facebook"
              note="حساب سحابي آمن ومتزامن"
              busy={busy === 'facebook'}
              disabled={busy !== null || !firebaseReady}
              icon={<FacebookMark />}
              onClick={() => void run('facebook')}
            />
            <AuthButton
              label="العب كضيف"
              note="التقدم والرصيد محفوظان على الجهاز ده فقط"
              busy={busy === 'guest'}
              disabled={busy !== null}
              icon={<UserRound className="h-5 w-5" />}
              onClick={() => void run('guest')}
              guest
            />
          </div>

          {!firebaseReady && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-right text-xs leading-5 text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              الحسابات السحابية محتاجة إعداد Firebase. تقدر تدخل كضيف دلوقتي.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-blood-500/45 bg-blood-900/35 px-3 py-2 text-xs font-bold leading-5 text-blood-200">
              {error}
            </p>
          )}

          <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            مش بنخزن كلمة السر — الدخول بيتم مباشرة عن طريق Firebase
          </p>
        </motion.section>
      </div>
    </main>
  );
}

function PlayerNameGateBoundary({ children }: { children: ReactNode }) {
  const { profile, profileLoading, profileError, user, setPlayerName } = useAuth();
  if (profileLoading) return <AuthLoading />;
  if (profileError) return <main className="flex h-dvh items-center justify-center bg-[#05060a] px-4 text-center text-blood-200">{profileError.message}</main>;
  if (!profile || profile.nameStatus === 'required') {
    return <PlayerNameGate initialName={user?.displayName ?? ''} onSubmit={setPlayerName} />;
  }
  return children;
}

function AuthButton({ label, note, busy, disabled, icon, onClick, guest = false }: {
  label: string;
  note: string;
  busy: boolean;
  disabled: boolean;
  icon: ReactNode;
  onClick: () => void;
  guest?: boolean;
}) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[58px] w-full items-center gap-3 rounded-xl border px-4 text-right transition disabled:cursor-not-allowed disabled:opacity-45 ${guest ? 'border-night-600 bg-night-900/80 hover:border-gold-500/45' : 'border-white/15 bg-white/[0.07] hover:border-gold-400/55 hover:bg-white/[0.11]'}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-slate-100">
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-gold-300" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-100">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{note}</span>
      </span>
      <LogIn className="h-4 w-4 shrink-0 text-gold-400" />
    </motion.button>
  );
}

function AuthLoading() {
  return (
    <main className="flex h-dvh items-center justify-center bg-[#05060a] text-center">
      <div>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-400" />
        <p className="mt-3 text-sm font-bold text-slate-400">بنجهّز هويتك في الحارة...</p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
      <path fill="#fff" d="m16.67 15.56.53-3.49h-3.33V9.8c0-.96.47-1.89 1.96-1.89h1.51V4.95s-1.37-.24-2.68-.24c-2.74 0-4.53 1.67-4.53 4.7v2.66H7.08v3.49h3.05V24a12.2 12.2 0 0 0 3.74 0v-8.44h2.8Z" />
    </svg>
  );
}
