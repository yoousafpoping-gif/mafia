'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAudioSettings } from '@/context/AudioContext';
import { GAME_LOGO, GAME_TITLE } from '@/lib/branding';
import type { RoomSettingsState } from '@/lib/types';
import { authHeaders, useAuth } from '@/context/AuthContext';
import { SERVER_URL } from '@/lib/config';
import { claimGuestDaily, claimGuestLoginReward, claimGuestQuest, guestDailyInfo } from '@/lib/guestProfile';
import { CustomRoomModal } from './CustomRoomModal';
import { StoreModal } from './StoreModal';
import { HomeTopBar } from './HomeTopBar';
import { DailyTasksPanel } from './DailyTasksPanel';
import { LoginRewardsModal } from './LoginRewardsModal';
import {
  AlertTriangle,
  Bot,
  Coins,
  Loader2,
  LogIn,
  LogOut,
  Radar,
  Settings as SettingsIcon,
  SquarePlus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface LandingScreenProps {
  codeInput: string;
  onCodeChange: (value: string) => void;
  busy: boolean;
  connected: boolean;
  onCreate: () => void;
  onCreateCustom: (settings: RoomSettingsState) => void;
  onJoin: () => void;
  onPractice: () => void;
  onQuickMatch: () => void;
}

export function LandingScreen({
  codeInput,
  onCodeChange,
  busy,
  connected,
  onCreate,
  onCreateCustom,
  onJoin,
  onPractice,
  onQuickMatch,
}: LandingScreenProps) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [loginRewardsOpen, setLoginRewardsOpen] = useState(false);
  const [rewardBusy, setRewardBusy] = useState('');
  const [rewardMessage, setRewardMessage] = useState('');
  const { user, profile, refreshProfileSilent, updateGuestProfile } = useAuth();
  const canAct = Boolean(profile?.playerName) && !busy;
  const dailyInfo = useMemo(() => profile ? guestDailyInfo(profile, []) : null, [profile]);

  const claimReward = async (kind: 'gift' | 'quest', questId?: string) => {
    if (!user || !profile) return;
    setRewardBusy(kind === 'gift' ? 'gift' : `quest:${questId}`);
    setRewardMessage('');
    try {
      if (user.provider === 'guest') {
        updateGuestProfile((current) => kind === 'gift' ? claimGuestDaily(current) : claimGuestQuest(current, questId ?? ''));
      } else {
        const response = await fetch(`${SERVER_URL}${kind === 'gift' ? '/api/store/claim-daily' : '/api/profile/quests/claim'}`, {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }),
          body: JSON.stringify(kind === 'gift' ? {} : { questId }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'CLAIM_FAILED');
        await refreshProfileSilent();
      }
      setRewardMessage('تم التحصيل وإضافة المكافأة لرصيدك');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setRewardMessage(code === 'DAILY_CLAIMED' || code === 'QUEST_CLAIMED' ? 'المكافأة دي اتحصلت بالفعل' : 'مقدرناش نحصّل المكافأة دلوقتي');
    } finally {
      setRewardBusy('');
    }
  };

  const claimLoginReward = async (day: number) => {
    if (!user || !profile) return;
    setRewardBusy(`login:${day}`);
    setRewardMessage('');
    try {
      if (user.provider === 'guest') updateGuestProfile((current) => claimGuestLoginReward(current, day));
      else {
        const response = await fetch(`${SERVER_URL}/api/profile/login-rewards/claim`, {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }),
          body: JSON.stringify({ day }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'CLAIM_FAILED');
        await refreshProfileSilent();
      }
      setRewardMessage('تم استلام مكافأة اليوم');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setRewardMessage(code.includes('CLAIMED') ? 'المكافأة مستلمة بالفعل' : 'تعذر استلام المكافأة');
    } finally { setRewardBusy(''); }
  };

  return (
    <main
      className="custom-scrollbar relative h-dvh w-full overflow-y-auto overflow-x-hidden bg-[#05060a] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/assets/backgrounds/main_bg.jpeg')" }}
    >
      {/* dark noir wash over the photographic backdrop for text contrast */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-black/60 backdrop-brightness-75" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-black"
        animate={{ opacity: [0.1, 0.5, 0.1, 0.6, 0.2, 0.4] }}
        transition={{
          repeat: Infinity,
          duration: 4,
          ease: 'easeInOut',
          times: [0, 0.1, 0.3, 0.5, 0.8, 1],
        }}
      />

      <HomeTopBar user={user} profile={profile} onRewards={() => setLoginRewardsOpen(true)} onStore={() => setStoreOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-3 px-4 pb-8 pt-24">
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

            <MenuRow
              icon={<SettingsIcon className="h-4.5 w-4.5" />}
              ar="غرفة مخصصة"
              en="custom room"
              active={customOpen}
              disabled={!canAct}
              onClick={() => setCustomOpen(true)}
            />

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

            {/* STORE */}
            <MenuRow
              icon={<Coins className="h-4.5 w-4.5" />}
              ar={user ? `المتجر · ${profile?.coins ?? 0} كوينز` : 'المتجر'}
              en="cosmetic store"
              disabled={!user}
              onClick={() => setStoreOpen(true)}
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

      {profile && dailyInfo && (
        <div className="relative z-20 mx-4 mb-6 lg:m-0">
          <DailyTasksPanel
            profile={profile}
            busyKey={rewardBusy}
            message={rewardMessage}
            giftClaimable={dailyInfo.gift.claimable}
            giftCoins={dailyInfo.gift.nextCoins}
            giftGems={dailyInfo.gift.nextGems}
            onGift={() => void claimReward('gift')}
            onQuest={(questId) => void claimReward('quest', questId)}
          />
        </div>
      )}
      <CustomRoomModal
        open={customOpen}
        busy={busy}
        onClose={() => setCustomOpen(false)}
        onCreate={(settings) => {
          setCustomOpen(false);
          onCreateCustom(settings);
        }}
      />
      <LoginRewardsModal
        open={loginRewardsOpen}
        claimedDays={profile?.loginCalendar?.claimedDays ?? []}
        busy={rewardBusy.startsWith('login:')}
        message={rewardMessage}
        onClose={() => setLoginRewardsOpen(false)}
        onClaim={(day) => void claimLoginReward(day)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <StoreModal open={storeOpen} onClose={() => setStoreOpen(false)} />
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
  const { user, deleteAccount } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const muted = isMuted;
  const provider = user?.provider ?? 'guest';

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'الحذف فشل — جرب تاني');
    } finally {
      setDeleting(false);
    }
  };

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

            {/* منطقة الخطر — حذف الحساب نهائياً */}
            <div className="mt-4 border-t border-night-600/60 pt-3">
              <p className="mb-2 font-mono text-[9px] font-bold tracking-[0.28em] text-blood-400/70 uppercase">
                Danger Zone
              </p>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border border-blood-700/50 bg-blood-700/10 px-3.5 text-right transition hover:border-blood-500/70 hover:bg-blood-700/25"
              >
                <Trash2 className="h-4.5 w-4.5 shrink-0 text-blood-400" strokeWidth={1.5} />
                <span className="text-sm font-bold text-blood-400">
                  {provider === 'guest' ? 'حذف بياناتي من الجهاز' : 'حذف الحساب نهائياً'}
                </span>
              </button>
            </div>

            <p className="mt-3 text-center text-[10px] italic text-slate-600">
              اللعبة كلها على جهازك والصوت بين اللاعبين لايف
            </p>
          </motion.div>
      <DeleteAccountModal
        open={confirmDelete}
        busy={deleting}
        error={deleteError}
        provider={provider}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void confirmDeleteAccount()}
      />
    </motion.div>
  );
}

/* ---------------- حذف الحساب — تأكيد نهائي قبل المسح ---------------- */

function DeleteAccountModal({
  open,
  busy,
  error,
  provider,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  provider: 'facebook' | 'google' | 'guest';
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const ready = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(ready);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onClose}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border-2 border-blood-600/60 bg-[#170d0c]/95 p-5 text-white shadow-[0_0_50px_rgba(0,0,0,0.9)]"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blood-500/40 bg-blood-700/20">
                <AlertTriangle className="h-5 w-5 text-blood-400" strokeWidth={1.5} />
              </span>
              <h3 className="font-serif text-lg font-black text-blood-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {provider === 'guest' ? 'حذف بياناتك من الجهاز؟' : 'حذف الحساب نهائياً؟'}
              </h3>
            </div>

            <div className="rounded-xl border border-blood-700/40 bg-blood-700/10 p-3.5 text-sm leading-relaxed">
              <p className="font-bold text-white">هذا الإجراء سيمسح كل تقدمك ولا يمكن التراجع عنه.</p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-slate-300">
                <li>مستواك وخبرتك وإحصائياتك</li>
                <li>العملات والجواهر وكل مشترياتك</li>
                {provider !== 'guest' && <li>بياناتك من خوادم اللعبة وحسابك من نظام الدخول</li>}
              </ul>
              {provider !== 'guest' && (
                <p className="mt-2 text-xs text-slate-400">
                  ممكن تظهرلك نافذة تأكيد هوية من {provider === 'facebook' ? 'فيسبوك' : 'جوجل'} لإتمام الحذف.
                </p>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-blood-500/40 bg-blood-700/15 px-3 py-2 text-center text-xs font-bold text-blood-400">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2.5">
              <button
                onClick={onClose}
                disabled={busy}
                className="min-h-[46px] flex-1 rounded-xl border border-night-600 bg-night-900/70 text-sm font-bold text-slate-300 transition hover:text-white disabled:opacity-40"
              >
                لا، رجعت في كلامي
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl border border-blood-500/60 bg-gradient-to-b from-blood-600 to-blood-700 text-sm font-black text-white shadow-[0_0_22px_rgba(220,38,38,0.35)] transition hover:shadow-[0_0_28px_rgba(220,38,38,0.55)] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {busy ? 'جاري الحذف…' : 'أيوه، امسح كل حاجة'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
