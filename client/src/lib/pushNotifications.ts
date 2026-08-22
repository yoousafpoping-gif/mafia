'use client';

/**
 * Web Push من جهة الكلاينت:
 * - طلب إذن الإشعارات بعد تسجيل الدخول (useAuth بيستدعيها).
 * - اشتراك Push حقيقي (VAPID) مع سيرفر اللعبة → إشعارات حتى والتاب مقفول.
 * - إشعار محلي احتياطي لما التاب يكون مخفي بس الاشتراك الحقيقي مش شغال.
 * كل الدوال بتشتغل بصمت لو المتصفح مش داعم — عمرها ما تكسر حاجة.
 */

import { SERVER_URL } from './config';

const SUBSCRIBED_FLAG = 'mafia-push-subscribed';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function hasPushSubscription(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SUBSCRIBED_FLAG) === '1';
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/**
 * طلب الإذن + الاشتراك الحقيقي — بتتنادى مرة بعد الدخول (idempotent).
 * بترجّع true لو الاشتراك الحقيقي اتظبط.
 */
export async function enablePushForUser(
  playerId: string,
  displayName: string,
): Promise<boolean> {
  if (!pushSupported() || Notification.permission === 'denied') return false;

  try {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;
    }

    const registration = await registerSw();
    if (!registration) return false;

    // المفتاح العام من السيرفر
    const keyRes = await fetch(`${SERVER_URL}/api/push/vapid-public-key`);
    if (!keyRes.ok) return false;
    const { publicKey } = (await keyRes.json()) as { publicKey: string };
    if (!publicKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const res = await fetch(`${SERVER_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, name: displayName, subscription: subscription.toJSON() }),
    });
    if (!res.ok) return false;

    try {
      window.localStorage.setItem(SUBSCRIBED_FLAG, '1');
    } catch {
      /* storage unavailable */
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * ربط الاشتراك الحالي بمعرّف القعدة جوه الأوضة — السيرفر بيبعت إشعارات
 * المراحل على معرّفات لاعبي الأوضة، والدخول بيربط الحساب. ده بيوصل الاتنين.
 * ما بيطلبش إذن جديد — بيتجاهل بصمت لو مفيش اشتراك شغال.
 */
export async function syncRoomPushBinding(roomPlayerId: string, name: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await fetch(`${SERVER_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: roomPlayerId, name, subscription: subscription.toJSON() }),
    });
  } catch {
    /* offline — الربط هيتحاول تاني مع القعدة الجاية */
  }
}

/** إشعار محلي — افتراضيًا بس لما التاب مخفي (ومفيش اشتراك دفع).
 *  force: لإشعار الدعوة — بيتعرض حتى لو التاب ظاهر (المستخدم لسه واصل). */
export async function localNotify(
  title: string,
  body: string,
  url = '/',
  opts?: { force?: boolean },
): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  if (!opts?.force && (!document.hidden || hasPushSubscription())) return;
  try {
    const registration = (await navigator.serviceWorker.getRegistration()) ?? (await registerSw());
    if (!registration) return;
    await registration.showNotification(title, { body, dir: 'rtl', lang: 'ar', tag: 'mafia-game', data: { url } });
  } catch {
    /* sw unavailable — إشعار محلي مش ممكن */
  }
}
