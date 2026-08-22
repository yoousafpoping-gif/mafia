'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAudioSettings } from '@/context/AudioContext';
import { GAME_LOGO, GAME_TITLE } from '@/lib/branding';
import { useAuth } from '@/context/AuthContext';
import {
  Bot,
  Coins,
  Globe,
  Loader2,
  LogIn,
  LogOut,
  Radar,
  Settings as SettingsIcon,
  SquarePlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface LandingScreenProps {
  name: string;
  onNameChange: (value: string) => void;
  codeInput: string;
  onCodeChange: (value: string) => void;
  busy: boolean;
  connected: boolean;
  onCreate: () => void;
  onJoin: () => void;
  onPractice: () => void;
  onQuickMatch: () => void;
}

export function LandingScreen({
  name,
  onNameChange,
  codeInput,
  onCodeChange,
  busy,
  connected,
  onCreate,
  onJoin,
  onPractice,
  onQuickMatch,
}: LandingScreenProps) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canAct = name.trim().length >= 2 && !busy;
  const { user, profile, loading: authLoading, googleReady, signInWithGoogle, signOut } = useAuth();
  const [authBusy, setAuthBusy] = useState(false);

  const handleGoogle = async () => {
    setAuthBusy(true);
    try {
      await signInWithGoogle(name);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <main className="custom-scrollbar relative h-dvh w-full overflow-y-auto overflow-x-hidden bg-[#05060a] bg-[url('/assets/backgrounds/main_bg.jpeg')] bg-cover bg-center bg-no-repeat">
      {/* dark noir wash over the photographic backdrop for text contrast */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/60 backdrop-brightness-75" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-3 px-4 py-5">
        <GameLogoFx />

        <div className="text-center">
          <h1 className="logo-bevel font-serif text-4xl leading-tight font-black tracking-wide sm:text-5xl">
            {GAME_TITLE}
          </h1>
          <p className="mt-2 text-xs font-bold tracking-[0.4em] text-slate-500 uppercase">
            مجلس الظلام · لا تثق في حد
          </p>
        </div>

        {/* glassmorphic menu */}
        <motion.div
          initial={{ y: 26, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.55 }}
          className="mt-1 w-[90%] max-w-md rounded-2xl border border-white/15 bg-black/45 p-4 shadow-[0_0_60px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-md sm:p-5 lg:w-96"
        >
          {/* دخول جوجل / بروفايل اللاعب */}
          <div className="mb-3">
            {authLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-400" />
                بنشوف جلستك...
              </div>
            ) : user ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-gold-500/40 bg-gold-500/[0.08] px-3 py-2">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 rounded-full border border-gold-500/60 object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/60 bg-night-950 font-serif text-xs font-black text-gold-200">
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-gold-100">
                    {user.displayName}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{profile?.rank ?? 'مواطن'}</span>
                    {profile && (
                      <span className="flex items-center gap-0.5 font-mono font-bold text-gold-400">
                        <Coins className="h-3 w-3" /> {profile.coins}
                      </span>
                    )}
                  </span>
                </span>
                <button
                  onClick={() => void signOut()}
                  title="اخرج من الحساب"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-night-600 bg-night-900/80 text-slate-400 transition hover:border-blood-500/60 hover:text-blood-300"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => void handleGoogle()}
                disabled={authBusy}
                className="flex min-h-[46px] w-full items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 transition hover:border-gold-400/50 hover:bg-white/[0.1] disabled:cursor-not-wait disabled:opacity-60"
              >
                {authBusy ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gold-300" />
                ) : (
                  <GoogleMark className="h-5 w-5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 text-right">
                  <span className="block text-sm leading-tight font-black text-slate-100">
                    ادخل بحساب جوجل
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {googleReady
                      ? '500 كوينز هدية أول دخول + صدارة أسبوعية'
                      : 'وضع تجريبي محلي — نفس البروفايل والصدارة من غير أكونت'}
                  </span>
                </span>
              </button>
            )}
          </div>

          <label className="mb-3 block">
            <span className="mb-1 block font-mono text-[9px] tracking-[0.3em] text-slate-500 uppercase">
              your name · اسمك
            </span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={16}
              placeholder="اكتب اسمك هنا..."
              className="w-full rounded-lg border border-night-600 bg-night-900/90 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20"
            />
          </label>

          <nav className="space-y-2">
            {/* CREATE ROOM — primary */}
            <motion.button
              whileHover={canAct ? { scale: 1.05 } : undefined}
              whileTap={canAct ? { scale: 0.97 } : undefined}
              onClick={onCreate}
              disabled={!canAct}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-gold-400/70 bg-gradient-to-l from-blood-800 via-blood-700 to-blood-600 px-3.5 shadow-[0_0_24px_rgba(185,28,28,0.4)] transition-shadow duration-200 enabled:hover:shadow-[0_0_40px_rgba(239,68,68,0.65)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-400/60 bg-black/30 text-gold-300">
                <SquarePlus className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1 text-right">
                <span className="block font-serif text-base leading-tight font-black text-white">
                  اعمل أوضة جديدة
                </span>
                <span className="block font-mono text-[9px] tracking-[0.28em] text-amber-200/70 uppercase">
                  create room
                </span>
              </span>
            </motion.button>

            {/* QUICK MATCH — البحث السريع */}
            <motion.button
              whileHover={canAct ? { scale: 1.05 } : undefined}
              whileTap={canAct ? { scale: 0.97 } : undefined}
              onClick={onQuickMatch}
              disabled={!canAct}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-gold-400/70 bg-gradient-to-l from-gold-700/40 via-gold-600/25 to-gold-500/15 px-3.5 shadow-[0_0_20px_rgba(229,181,103,0.18)] transition-shadow duration-200 enabled:hover:shadow-[0_0_34px_rgba(229,181,103,0.4)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-lg border border-gold-400/70 bg-black/30 text-gold-300">
                <Radar className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1 text-right">
                <span className="block font-serif text-base leading-tight font-black text-gold-100">
                  بحث سريع
                </span>
                <span className="block font-mono text-[9px] tracking-[0.28em] text-amber-200/70 uppercase">
                  quick match
                </span>
              </span>
            </motion.button>

            {/* JOIN ROOM */}
            <MenuRow
              icon={<LogIn className="h-4.5 w-4.5" />}
              ar="ادخل بأوضة"
              en="join room"
              active={joinOpen}
              onClick={() => setJoinOpen((value) => !value)}
            />

            <AnimatePresence initial={false}>
              {joinOpen && (
                <motion.div
                  key="join-row"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 px-1 pt-1 pb-2">
                    <input
                      value={codeInput}
                      onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
                      onKeyDown={(event) => event.key === 'Enter' && onJoin()}
                      maxLength={6}
                      placeholder="الكود"
                      className="w-full min-w-0 flex-1 rounded-lg border border-night-600 bg-night-900/90 px-3 py-2 text-center font-mono text-base tracking-[0.3em] text-gold-300 placeholder-slate-600 outline-none focus:border-gold-500/60"
                    />
                    <button
                      onClick={onJoin}
                      disabled={!canAct || codeInput.trim().length < 4}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gold-500/50 bg-gold-500/15 px-3.5 font-bold text-gold-300 transition enabled:hover:bg-gold-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <LogIn className="h-4 w-4" />
                      دخول
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PRACTICE VS BOTS */}
            <MenuRow
              icon={<Bot className="h-4.5 w-4.5" />}
              ar="تمرين على البوتات"
              en="practice vs bots"
              disabled={!canAct || busy}
              onClick={onPractice}
            />

            {/* MULTIPLAYER */}
            <MenuRow
              icon={<Globe className="h-4.5 w-4.5" />}
              ar="أونلاين ضد الناس"
              en="multiplayer"
              onClick={() => setJoinOpen(true)}
            />

            {/* SETTINGS */}
            <MenuRow
              icon={<SettingsIcon className="h-4.5 w-4.5" />}
              ar="الإعدادات"
              en="settings"
              tone="slate"
              onClick={() => setSettingsOpen(true)}
            />

            {/* QUIT GAME */}
            <MenuRow
              icon={<LogOut className="h-4.5 w-4.5" />}
              ar="اخرج من اللعبة"
              en="quit game"
              tone="danger"
              onClick={() => window.close()}
            />
          </nav>

          <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
            {busy ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-gold-400" />
                لحظة..
              </>
            ) : (
              'من 4 لـ 12 لاعب · كل واحد على جهازه'
            )}
          </p>
        </motion.div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

/* ---------------- logo + ember FX ---------------- */

/** جمرات صاعدة — إحداثيات حتمية (نقاء الـ render) بمنتَج xorshift بسيط */
function emberRandom(seed: number): number {
  let x = (Math.imul(seed + 1, 1597334677) >>> 0) || 0x2545f491;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  return x / 4294967296;
}

const EMBER_COLORS = ['#fde68a', '#fbbf24', '#d4af37', '#f97316', '#fff7d6'];

function GameLogoFx() {
  const embers = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    left: 8 + emberRandom(i * 11 + 1) * 84,
    bottom: -6 + emberRandom(i * 11 + 2) * 40,
    size: 3 + emberRandom(i * 11 + 3) * 5,
    dur: 2.2 + emberRandom(i * 11 + 4) * 2.6,
    delay: emberRandom(i * 11 + 5) * 3,
    dx: (emberRandom(i * 11 + 6) - 0.5) * 60,
    color: EMBER_COLORS[i % EMBER_COLORS.length],
    round: emberRandom(i * 11 + 7) > 0.45,
  }));

  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0, y: -14 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16 }}
      className="relative mb-2"
    >
      {/* طبقة التوهج الذهبي — هالة نابضة خلف اللوجو */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-5 rounded-full bg-gold-500/25 blur-3xl"
        animate={{ opacity: [0.45, 0.9, 0.45], scale: [0.94, 1.08, 0.94] }}
        transition={{ repeat: Infinity, duration: 3 }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(253,230,138,0.28),_transparent_65%)] blur-xl"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2.2 }}
      />
      {/* جمرات نارية بتطلع لفوق حوالين اللوجو */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
        {embers.map((e) => (
          <span
            key={e.id}
            className="animate-float-sparks absolute block"
            style={
              {
                left: `${e.left}%`,
                bottom: `${e.bottom}px`,
                width: e.size,
                height: e.round ? e.size : e.size * 0.5,
                backgroundColor: e.color,
                borderRadius: e.round ? '9999px' : '2px',
                boxShadow: `0 0 ${e.size + 4}px ${e.color}`,
                '--sdur': `${e.dur}s`,
                '--sdelay': `${e.delay}s`,
                '--sdx': `${e.dx}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
      {/* اللوجو نفسه — فوق كل الطبقات بتوهج ذهبي حاد */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={GAME_LOGO}
        alt={GAME_TITLE}
        className="relative z-10 mx-auto mb-4 h-44 w-44 animate-pulse object-contain drop-shadow-[0_0_35px_rgba(212,175,55,0.8)]"
      />
    </motion.div>
  );
}

/* ---------------- google G mark ---------------- */

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden style={{ display: 'block' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/* ---------------- menu row ---------------- */

function MenuRow({
  icon,
  ar,
  en,
  onClick,
  active,
  disabled,
  tone = 'gold',
}: {
  icon: React.ReactNode;
  ar: string;
  en: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'gold' | 'slate' | 'danger';
}) {
  const tones = {
    gold: 'border-white/10 bg-white/[0.06] hover:border-gold-400/50 hover:bg-white/[0.1] hover:shadow-[0_0_22px_rgba(229,181,103,0.28)]',
    slate: 'border-white/10 bg-white/[0.06] hover:border-slate-400/40 hover:bg-white/[0.1]',
    danger:
      'border-white/10 bg-white/[0.05] hover:border-blood-500/60 hover:bg-blood-700/20 hover:shadow-[0_0_22px_rgba(220,38,38,0.35)]',
  };
  const iconTones = {
    gold: 'border-gold-500/40 bg-night-900/70 text-gold-300',
    slate: 'border-night-600 bg-night-900/70 text-slate-300',
    danger: 'border-night-600 bg-night-900/70 text-blood-300',
  };
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.05 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5 text-right backdrop-blur transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${
        active ? 'border-gold-400/60 bg-white/[0.1]' : ''
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${iconTones[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-serif text-base leading-tight font-black ${tone === 'danger' ? 'text-blood-200' : 'text-gold-100'}`}>
          {ar}
        </span>
        <span className="block font-mono text-[9px] tracking-[0.28em] text-slate-500 uppercase">
          {en}
        </span>
      </span>
    </motion.button>
  );
}

/* ---------------- settings ---------------- */

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && <SettingsPanel onClose={onClose} />}
    </AnimatePresence>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { isMuted, toggleMute } = useAudioSettings();
  const muted = isMuted;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm"
    >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
            className="leather-bg w-[90%] max-w-xs rounded-2xl border border-gold-500/40 p-4 shadow-2xl"
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-metallic-gold font-serif text-lg font-black">الإعدادات</h3>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-night-600 bg-night-800 text-slate-400 transition hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <button
              onClick={toggleMute}
              className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-night-600/70 bg-night-900/70 px-3.5"
            >
              <span className="flex items-center gap-2.5">
                {muted ? <VolumeX className="h-4.5 w-4.5 text-blood-400" /> : <Volume2 className="h-4.5 w-4.5 text-emerald-400" />}
                <span className="text-sm font-bold text-slate-200">مؤثرات الصوت</span>
              </span>
              <span
                className={`relative h-6.5 w-11 rounded-full transition-colors ${
                  muted ? 'bg-night-700' : 'bg-emerald-600'
                }`}
              >
                <span
                  className={`absolute top-1 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${
                    muted ? 'right-1' : 'right-[calc(100%-1.375rem)]'
                  }`}
                />
              </span>
            </button>

            <p className="mt-3 text-center text-[10px] italic text-slate-600">
              اللعبة كلها على جهازك والصوت بين اللاعبين لايف
            </p>
          </motion.div>
    </motion.div>
  );
}
