'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  browserSessionPersistence,
  deleteUser,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithPopup,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
  type AuthProvider as FirebaseProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  facebookProvider,
  firebaseAuth,
  firebaseReady,
  googleProvider,
} from '@/lib/firebase';
import { enablePushForUser } from '@/lib/pushNotifications';
import { clearGuestProfile, loadGuestProfile, saveGuestProfile } from '@/lib/guestProfile';
import type { DailyQuestDefinition } from '@/lib/progressionConfig';
import { upsertProfile, deleteProfile, updatePlayerName as firestoreUpdateName } from '@/lib/profileFirestore';

export interface AuthUser {
  uid: string;
  displayName: string;
  photoURL: string;
  provider: 'google' | 'facebook' | 'guest';
}

export interface PlayerProfile {
  schemaVersion: 4;
  playerName: string;
  nameStatus: 'required' | 'set';
  nameSetAt: string | null;
  coins: number;
  gems: number;
  rank: string;
  stats: { games: number; wins: number; losses: number; xp: number; rolePlays: Record<string, number> };
  badges: string[];
  inventory: string[];
  equipped: { cardFrame: string; title: string | null; emote: string | null; background: string | null };
  dailyGift?: { lastDay: string | null; streak: number };
  loginCalendar?: { monthKey: string; claimedDays: number[] };
  dailyQuests?: {
    dayKey: string;
    progress: Record<DailyQuestDefinition['metric'], number>;
    claimed: string[];
  };
  claimedLevelRewards?: number[];
  processedResults?: string[];
  updatedAt?: string;
  displayName?: string;
  photoURL?: string;
  provider?: string;
}

interface AuthState {
  user: AuthUser | null;
  profile: PlayerProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<PlayerProfile | null>>;
  loading: boolean;
  profileLoading: boolean;
  profileError: Error | null;
  authError: Error | null;
  firebaseReady: boolean;
  googleReady: boolean;
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshProfileSilent: () => Promise<void>;
  setPlayerName: (name: string) => Promise<void>;
  updateGuestProfile: (updater: (current: PlayerProfile) => PlayerProfile) => void;
}

const AuthContext = createContext<AuthState | null>(null);
const GUEST_SESSION_KEY = 'mafia-guest-session-v1';

function friendlyAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/operation-not-allowed': 'طريقة الدخول دي مش مفعّلة في Firebase Console',
    'auth/unauthorized-domain': 'النطاق ده مش مضاف في إعدادات Firebase Authentication',
    'auth/popup-blocked': 'المتصفح حجب نافذة الدخول — اسمح بالنوافذ المنبثقة وجرب تاني',
    'auth/popup-closed-by-user': 'قفلت نافذة الدخول قبل ما تخلص',
    'auth/cancelled-popup-request': 'في طلب دخول تاني شغال — استنى لحظة',
    'auth/network-request-failed': 'مشكلة نت في الوصول لخدمة الدخول — جرب تاني',
    'auth/too-many-requests': 'محاولات كتير — استنى شوية وجرب تاني',
    'auth/account-exists-with-different-credential': 'الإيميل ده مربوط بطريقة دخول مختلفة',
  };
  return new Error(map[code] ?? 'تسجيل الدخول فشل — جرب تاني');
}

function providerName(user: FirebaseUser): AuthUser['provider'] {
  return user.providerData.some((entry) => entry.providerId === 'facebook.com') ? 'facebook' : 'google';
}

function fromFirebaseUser(user: FirebaseUser): AuthUser {
  const provider = providerName(user);
  return {
    uid: user.uid,
    displayName: user.displayName ?? (provider === 'facebook' ? 'لاعب فيسبوك' : 'لاعب جوجل'),
    photoURL: user.photoURL ?? '',
    provider,
  };
}

function clearLegacyGuestSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

function readGuestSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (parsed.provider !== 'guest' || typeof parsed.uid !== 'string') return null;
    return {
      uid: parsed.uid,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : 'ضيف الحارة',
      photoURL: '',
      provider: 'guest',
    };
  } catch {
    return null;
  }
}

function writeGuestSession(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user?.provider === 'guest') window.sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(user));
    else window.sessionStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function syncProfile(user: AuthUser): Promise<PlayerProfile> {
  return upsertProfile(user.uid, {
    displayName: user.displayName,
    photoURL: user.photoURL,
    provider: user.provider,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [authError, setAuthError] = useState<Error | null>(null);
  const syncGeneration = useRef(0);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
    syncGeneration.current += 1;
  }, []);

  const loadProfile = useCallback(async (next: AuthUser, generation: number) => {
    if (next.provider === 'guest') {
      setProfile(loadGuestProfile());
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const fresh = await syncProfile(next);
        if (!mounted.current || generation !== syncGeneration.current) return;
        setProfile(fresh);
        setProfileLoading(false);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 400 * 2 ** attempt));
      }
    }
    if (!mounted.current || generation !== syncGeneration.current) return;
    const safeError = new Error('تعذر تحميل بيانات الحساب — حاول مرة أخرى');
    setProfileError(safeError);
    setProfileLoading(false);
    throw lastError instanceof Error ? lastError : safeError;
  }, []);

  const applyUser = useCallback(async (next: AuthUser | null) => {
    const generation = ++syncGeneration.current;
    setUser(next);
    setProfile(null);
    setProfileError(null);
    if (!next) {
      setProfileLoading(false);
      return;
    }
    if (next.provider !== 'guest') void enablePushForUser(next.uid, next.displayName);
    await loadProfile(next, generation);
  }, [loadProfile]);

  useEffect(() => {
    clearLegacyGuestSession();

    if (firebaseReady && firebaseAuth) {
      const auth = firebaseAuth;
      let unsub = () => {};
      let cancelled = false;

      void setPersistence(auth, browserSessionPersistence)
        .then(() => getRedirectResult(auth))
        .catch((err: unknown) => setAuthError(friendlyAuthError(err)))
        .finally(() => {
          if (cancelled) return;
          unsub = onAuthStateChanged(auth, (fbUser) => {
            const next = fbUser ? fromFirebaseUser(fbUser) : readGuestSession();
            void applyUser(next).finally(() => setLoading(false));
          });
        });

      return () => {
        cancelled = true;
        unsub();
      };
    }
    const hydrate = window.setTimeout(() => {
      void applyUser(readGuestSession()).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, [applyUser]);

  const signIn = useCallback(async (provider: FirebaseProvider | null) => {
    if (!firebaseReady || !firebaseAuth || !provider) {
      throw new Error('الحسابات السحابية محتاجة إعداد Firebase الأول');
    }
    setAuthError(null);
    try {
      writeGuestSession(null);
      const credential = await signInWithPopup(firebaseAuth, provider);
      await applyUser(fromFirebaseUser(credential.user));
    } catch (err) {
      const safeError = friendlyAuthError(err);
      setAuthError(safeError);
      throw safeError;
    }
  }, [applyUser]);

  const signInWithGoogle = useCallback(() => signIn(googleProvider), [signIn]);
  const signInWithFacebook = useCallback(() => signIn(facebookProvider), [signIn]);

  const continueAsGuest = useCallback(async () => {
    if (firebaseAuth?.currentUser) await firebaseSignOut(firebaseAuth);
    const existing = readGuestSession();
    const guest: AuthUser = existing ?? {
      uid: `guest:${crypto.randomUUID()}`,
      displayName: 'ضيف الحارة',
      photoURL: '',
      provider: 'guest',
    };
    writeGuestSession(guest);
    await applyUser(guest);
  }, [applyUser]);

  const signOut = useCallback(async () => {
    if (firebaseAuth?.currentUser) await firebaseSignOut(firebaseAuth);
    writeGuestSession(null);
    await applyUser(null);
  }, [applyUser]);

  /* حذف الحساب نهائياً: مسح بيانات اللاعب من السيرفر الأول (التوكن لسه
     صالح)، وبعدها حذف حساب Firebase Auth. لو الجلسة قديمة Firebase
     بيرمي auth/requires-recent-login فبنفتح نافذة إعادة المصادقة
     (فيسبوك/جوجل) ونكمل الحذف تلقائياً. */
  const deleteAccount = useCallback(async () => {
    if (!user) throw new Error('سجّل الدخول الأول');

    if (user.provider === 'guest') {
      clearGuestProfile();
      writeGuestSession(null);
      await applyUser(null);
      return;
    }

    const auth = firebaseAuth;
    if (!firebaseReady || !auth) throw new Error('الحسابات السحابية محتاجة إعداد Firebase الأول');

    try {
      await deleteProfile(user.uid);
    } catch {
      /* تجاهل — الحذف من Firestore قد يفشل لو المستند مش موجود */
    }

    const fbUser = auth.currentUser;
    if (fbUser) {
      try {
        await deleteUser(fbUser);
      } catch (err) {
        if ((err as { code?: string })?.code !== 'auth/requires-recent-login') {
          throw new Error('حذف الحساب فشل — جرب تاني');
        }
        const provider = user.provider === 'facebook' ? facebookProvider : googleProvider;
        if (!provider) throw new Error('مقدم الدخول مش متاح — جرب تاني');
        try {
          await reauthenticateWithPopup(fbUser, provider);
          await deleteUser(fbUser);
        } catch (reauthErr) {
          const code = (reauthErr as { code?: string })?.code ?? '';
          const map: Record<string, string> = {
            'auth/popup-blocked': 'المتصفح حجب نافذة تأكيد الهوية — اسمح بالنوافذ المنبثقة وجرب تاني',
            'auth/popup-closed-by-user': 'قفلت نافذة تأكيد الهوية قبل ما تخلص',
            'auth/cancelled-popup-request': 'في طلب تاني شغال — استنى لحظة وجرب تاني',
            'auth/network-request-failed': 'مشكلة نت أثناء تأكيد الهوية — جرب تاني',
            'auth/too-many-requests': 'محاولات كتير — استنى شوية وجرب تاني',
          };
          throw new Error(map[code] ?? 'تأكيد الهوية فشل — جرب تاني');
        }
      }
    }

    writeGuestSession(null);
    await applyUser(null);
  }, [user, applyUser]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    if (user.provider === 'guest') {
      setProfile(loadGuestProfile());
      return;
    }
    await loadProfile(user, syncGeneration.current);
  }, [user, loadProfile]);

  /** تحديث البروفايل من السيرفر بدون تفعيل profileLoading — عشان المتجر
      والعمليات ما تخفيش الواجهة كلها. */
  const refreshProfileSilent = useCallback(async () => {
    if (!user || user.provider === 'guest') return;
    try {
      const fresh = await syncProfile(user);
      if (mounted.current) setProfile(fresh);
    } catch {
      /* تجاهل — البيانات القديمة لسه صالحة */
    }
  }, [user]);

  const setPlayerName = useCallback(async (name: string) => {
    if (!user) throw new Error('سجّل الدخول الأول');
    if (user.provider === 'guest') {
      const current = loadGuestProfile();
      const next: PlayerProfile = {
        ...current,
        playerName: name,
        nameStatus: 'set',
        nameSetAt: new Date().toISOString(),
      };
      saveGuestProfile(next);
      setProfile(next);
      return;
    }
    const updated = await firestoreUpdateName(user.uid, name);
    setProfile(updated);
  }, [user]);

  const updateGuestProfile = useCallback((updater: (current: PlayerProfile) => PlayerProfile) => {
    setProfile((current) => {
      const next = updater(current ?? loadGuestProfile());
      saveGuestProfile(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    setProfile,
    loading,
    profileLoading,
    profileError,
    authError,
    firebaseReady,
    googleReady: firebaseReady,
    isGuest: user?.provider === 'guest',
    signInWithGoogle,
    signInWithFacebook,
    continueAsGuest,
    signOut,
    deleteAccount,
    refreshProfile,
    refreshProfileSilent,
    setPlayerName,
    updateGuestProfile,
  }), [user, profile, setProfile, loading, profileLoading, profileError, authError, signInWithGoogle, signInWithFacebook, continueAsGuest, signOut, deleteAccount, refreshProfile, refreshProfileSilent, setPlayerName, updateGuestProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
