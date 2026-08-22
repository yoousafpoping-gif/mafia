import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { logger } from '../utils/logger.js';

/**
 * Web Push (VAPID) — إشعارات المتصفح لحداث اللعبة:
 * بداية الماتش وطلوع النهار (DAY_DISCUSSION).
 *
 * المفاتيح بتتولد مرة واحدة وتتحفظ في data/vapid.json، والاشتراكات
 * في data/push-subscriptions.json (playerId → subscription).
 * الإرسال fire-and-forget: فشل الإشعار عمره ما بيأثر على سير اللعبة.
 */

// DATA_DIR بيتبعت من البيئة على Render (ديسك دائم) — محليًا جوه الريبو
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const SUBS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  } catch (error) {
    logger.error(`Push store write failed: ${error.message}`);
  }
}

/* مفاتيح VAPID — توليد تلقائي أول تشغيل */
let vapidKeys = readJson(VAPID_FILE, null);
if (!vapidKeys?.publicKey || !vapidKeys?.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
  vapidKeys.subject = 'mailto:mafia@localhost';
  writeJson(VAPID_FILE, vapidKeys);
  logger.info('Push: generated new VAPID keys');
}
webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

/* playerId → { subscription, name } */
const subscriptions = new Map(
  Object.entries(readJson(SUBS_FILE, {})).map(([id, entry]) => [id, entry]),
);

function persistSubs() {
  writeJson(SUBS_FILE, Object.fromEntries(subscriptions));
}

export const pushService = {
  vapidPublicKey: vapidKeys.publicKey,

  saveSubscription(playerId, name, subscription) {
    if (!playerId || !subscription?.endpoint) return false;
    subscriptions.set(playerId, { subscription, name: name ?? '' });
    persistSubs();
    logger.info(`Push: subscription saved for ${playerId}`);
    return true;
  },

  removeSubscription(playerId) {
    const had = subscriptions.delete(playerId);
    if (had) persistSubs();
    return had;
  },

  /** إشعار مجموعة لاعبين بالإيد بتاعهم — مش بيرمي errors بره */
  async notifyPlayers(playerIds, { title, body, url }) {
    const payload = JSON.stringify({ title, body, url: url ?? '/' });
    for (const playerId of playerIds) {
      const entry = subscriptions.get(playerId);
      if (!entry) continue;
      try {
        await webpush.sendNotification(entry.subscription, payload, { TTL: 60 });
        logger.info(`Push: notified ${playerId}`);
      } catch (error) {
        const gone = error?.statusCode === 404 || error?.statusCode === 410;
        if (gone) {
          subscriptions.delete(playerId);
          persistSubs();
          logger.info(`Push: dropped dead subscription ${playerId}`);
        } else {
          logger.warn(`Push: notify ${playerId} failed — ${error?.message ?? error}`);
        }
      }
    }
  },

  /** إشعار كل اللاعبين القاعدين في أوضة (بعدواني — من غير انتظار) */
  notifyRoom(room, payload) {
    const ids = [...room.players.keys()];
    if (ids.length === 0) return;
    void this.notifyPlayers(ids, payload).catch(() => {});
  },
};
