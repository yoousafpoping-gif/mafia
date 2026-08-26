'use client';

/**
 * تهيئة Firebase — اختيارية بالكامل.
 * لو مفاتيح NEXT_PUBLIC_FIREBASE_* موجودة في .env.local يشتغل دخول
 * جوجل الحقيقي؛ لو ناقصة، اللعبة بتشتغل عادي والدخول بيتحول لوضع
 * محلي (بروفايل على السيرفر من غير أكونت جوجل).
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { FacebookAuthProvider, getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const configuredAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // Prefer the domain shipped with this exact Firebase config. Only derive the
  // standard project domain when the environment variable is genuinely absent.
  authDomain: configuredAuthDomain || (projectId ? `${projectId}.firebaseapp.com` : undefined),
  projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** true بس لما كل مفاتيح اللازمة تكون موجودة */
export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseReady) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export const googleProvider = firebaseReady
  ? new GoogleAuthProvider()
  : null;

export const facebookProvider = firebaseReady
  ? new FacebookAuthProvider()
  : null;

export { app as firebaseApp, auth as firebaseAuth, db as firebaseDb };
