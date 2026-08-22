'use client';

/**
 * تهيئة Firebase — اختيارية بالكامل.
 * لو مفاتيح NEXT_PUBLIC_FIREBASE_* موجودة في .env.local يشتغل دخول
 * جوجل الحقيقي؛ لو ناقصة، اللعبة بتشتغل عادي والدخول بيتحول لوضع
 * محلي (بروفايل على السيرفر من غير أكونت جوجل).
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** true بس لما كل مفاتيح اللازمة تكون موجودة */
export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (firebaseReady) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export const googleProvider = firebaseReady
  ? new GoogleAuthProvider()
  : null;

export { app as firebaseApp, auth as firebaseAuth };
