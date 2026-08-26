import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let authPromise;

function credentialFromEnvironment() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return cert(JSON.parse(raw));
  return applicationDefault();
}

async function adminAuth() {
  if (!authPromise) {
    authPromise = Promise.resolve().then(() => {
      const app = getApps()[0] ?? initializeApp({
        credential: credentialFromEnvironment(),
        projectId: process.env.FIREBASE_PROJECT_ID || undefined,
      });
      return getAuth(app);
    });
  }
  return authPromise;
}

export async function verifyFirebaseToken(req, res, next) {
  const header = req.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  try {
    const decoded = await (await adminAuth()).verifyIdToken(match[1], true);
    req.auth = { uid: decoded.uid, token: decoded };
    return next();
  } catch {
    return res.status(401).json({ error: 'INVALID_ID_TOKEN' });
  }
}
