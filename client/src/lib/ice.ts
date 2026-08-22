'use client';

/**
 * ICE servers resolver — STUN دايماً، و TURN لو موجود.
 *
 * TURN بيتقرأ من مصدرين (الأول له الأولوية):
 * 1. متغيرات البناء NEXT_PUBLIC_TURN_* (.env.local)
 * 2. مستند Firestore `config/turn` — تحديث من غير إعادة نشر
 *    { url: "turn:host:port,tURNS:...", username, password }
 *
 * من غير TURN اللعب على نفس الشبكة شغال، لكن العبور بين شبكتين
 * (موبايل داتا ↔ وايفاي) ممكن يفشل بسبب NAT.
 */
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from './firebase';

const STUN_ONLY: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

let cached: Promise<RTCIceServer[]> | null = null;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      () => {
        window.clearTimeout(t);
        resolve(null);
      },
    );
  });

function fromEnv(): RTCIceServer[] | null {
  const url = process.env.NEXT_PUBLIC_TURN_URL;
  if (!url) return null;
  return [
    ...STUN_ONLY,
    {
      urls: url.split(',').map((s) => s.trim()).filter(Boolean),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_PASSWORD,
    },
  ];
}

async function fromFirestore(): Promise<RTCIceServer[] | null> {
  if (!firebaseDb) return null;
  const snap = await withTimeout(getDoc(doc(firebaseDb, 'config', 'turn')), 2500);
  const data = snap?.data() as { url?: string; username?: string; password?: string } | undefined;
  if (!data?.url || !data.username || !data.password) return null;
  return [
    ...STUN_ONLY,
    {
      urls: data.url.split(',').map((s) => s.trim()).filter(Boolean),
      username: data.username,
      credential: data.password,
    },
  ];
}

export function loadIceServers(): Promise<RTCIceServer[]> {
  if (!cached) {
    cached = (async () => fromEnv() ?? (await fromFirestore()) ?? STUN_ONLY)();
  }
  return cached;
}
