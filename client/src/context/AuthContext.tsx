'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { firebaseAuth, firebaseReady, googleProvider } from '@/lib/firebase';
import { SERVER_URL } from '@/lib/config';
import { enablePushForUser } from '@/lib/pushNotifications';

/** هوية الجلسة — من جوجل أو من الوضع المحلي الاحتياطي */
export interface AuthUser {
  uid: string;
  displayName: string;
  photoURL: string;
  provider: 'google' | 'local';
}

/** أرقام اللاعب المحفوظة على السيرفر */
export interface PlayerProfile {
  coins: number;
  rank: string;
  wins: number;
  totalGames: number;
}

interface AuthState {
  user: AuthUser | null;
  profile: PlayerProfile | null;
  loading: boolean;
  /** true لما firebase مفاتيحه موجودة — الدخول بيبقى جوجل حقيقي */
  googleReady: boolean;
  signInWithGoogle: (displayNameFallback?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** تحديث الأرقام من السيرفر (بعد تسجيل نتيجة مثلًا) */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const LOCAL_SESSION_KEY = 'mafia-auth-session-v1';

function readLocalSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    return parsed?.uid ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalSession(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** upsert على سيرفر اللعبة — البروفايل الجديد بينزل بـ500 كوينز ورتبة مواطن */
async function syncProfile(user: AuthUser): Promise<PlayerProfile> {
  const res = await fetch(`${SERVER_URL}/api/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      provider: user.provider,
    }),
  });
  if (!res.ok) throw new Error('profile sync failed');
  const data = (await res.json()) as { profile: PlayerProfile };
  return data.profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback(async (next: AuthUser | null) => {
    setUser(next);
    if (!next) {
      setProfile(null);
      return;
    }
    // طلب إذن الإشعارات + اشتراك الدفع بعد الدخول (idempotent — مفيش مطالبات متكررة)
    void enablePushForUser(next.uid, next.displayName);
    try {
      setProfile(await syncProfile(next));
    } catch {
      /* السيرفر مش متصل — الجلسة شغالة، والأرقام تتجدد أول ما يرجع */
    }
  }, []);

  /* استرجاع الجلسة — firebase بيفضل مسجّل لوحده، والوضع المحلي من localStorage.
     الاسترجاع المحلي مؤجّل بميكرو-تايمر — setState مباشر جوه الإفكت بيعمل cascading renders. */
  useEffect(() => {
    if (firebaseReady && firebaseAuth) {
      const unsub = onAuthStateChanged(firebaseAuth, (fbUser) => {
        void applyUser(
          fbUser
            ? {
                uid: fbUser.uid,
                displayName: fbUser.displayName ?? 'لاعب جوجل',
                photoURL: fbUser.photoURL ?? '',
                provider: 'google',
              }
            : null,
        ).finally(() => setLoading(false));
      });
      return () => unsub();
    }
    const hydrate = window.setTimeout(() => {
      void applyUser(readLocalSession()).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, [applyUser]);

  const signInWithGoogle = useCallback(
    async (displayNameFallback?: string) => {
      if (firebaseReady && firebaseAuth && googleProvider) {
        const credential = await signInWithPopup(firebaseAuth, googleProvider);
        await applyUser({
          uid: credential.user.uid,
          displayName: credential.user.displayName ?? 'لاعب جوجل',
          photoURL: credential.user.photoURL ?? '',
          provider: 'google',
        });
        return;
      }
      // وضع محلي — نفس البروفايل على السيرفر من غير أكونت جوجل
      const localUser: AuthUser = {
        uid: `local:${(typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID().slice(0, 12)
          : String(Date.now())}`,
        displayName: displayNameFallback?.trim() || 'لاعب سري',
        photoURL: '',
        provider: 'local',
      };
      writeLocalSession(localUser);
      await applyUser(localUser);
    },
    [applyUser],
  );

  const signOut = useCallback(async () => {
    if (firebaseReady && firebaseAuth) await firebaseSignOut(firebaseAuth);
    writeLocalSession(null);
    await applyUser(null);
  }, [applyUser]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      setProfile(await syncProfile(user));
    } catch {
      /* offline — retry on next sync */
    }
  }, [user]);

  const value = useMemo(
    () => ({ user, profile, loading, googleReady: firebaseReady, signInWithGoogle, signOut, refreshProfile }),
    [user, profile, loading, signInWithGoogle, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
