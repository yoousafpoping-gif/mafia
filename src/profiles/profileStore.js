import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';

/**
 * مخزن بروفايلات اللاعبين ولوحة الصدارة الأسبوعية.
 * JSON بسيط على الديسك — كافي لحجم اللعبة، وممكن يستبدل بـFirestore/Supabase
 * بعدين من غير ما أي حاجة تانية تتغير (نفس الـinterface بالظبط).
 */

// DATA_DIR بيتبعت من البيئة على Render (ديسك دائم) — محليًا جوه الريبو
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'profiles.json');

/** مفتاح الأسبوع بصيغة ISO (2026-W34) — بتتقارن مع كل طلب صدارة */
function currentWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const DEFAULT_PROFILE = {
  coins: 500,
  rank: 'مواطن',
  wins: 0,
  totalGames: 0,
};

class ProfileStore {
  constructor() {
    this.profiles = new Map();
    this.weekKey = currentWeekKey();
    this.#load();
  }

  #load() {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      this.weekKey = raw.weekKey ?? currentWeekKey();
      for (const profile of raw.profiles ?? []) {
        if (profile?.uid) this.profiles.set(profile.uid, profile);
      }
      logger.info(`Profile store loaded: ${this.profiles.size} profile(s)`);
    } catch (error) {
      logger.error(`Profile store load failed, starting fresh: ${error.message}`);
    }
  }

  #save() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify({ weekKey: this.weekKey, profiles: [...this.profiles.values()] }, null, 2),
        'utf8',
      );
    } catch (error) {
      logger.error(`Profile store save failed: ${error.message}`);
    }
  }

  /** تصفير عدّادات الأسبوع أول ما أسبوع جديد يبدأ */
  #rollWeekIfNeeded() {
    const now = currentWeekKey();
    if (now === this.weekKey) return;
    logger.info(`Leaderboard weekly reset: ${this.weekKey} → ${now}`);
    this.weekKey = now;
    for (const profile of this.profiles.values()) {
      profile.weeklyWins = 0;
      profile.weeklyGames = 0;
    }
    this.#save();
  }

  #sanitize(value, maxLen) {
    return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
  }

  /**
   * إنشاء أو تحديث بروفايل من الدخول — الأرقام المحفوظة عمرها ما بتتصفّر هنا.
   * البروفايل الجديد بينزل بالقيم الافتراضية: 500 كوينز، رتبة مواطن، صفر ألعاب.
   */
  upsert({ uid, displayName, photoURL, provider }) {
    const cleanUid = this.#sanitize(uid, 64);
    if (!cleanUid) throw new Error('uid required');

    const existing = this.profiles.get(cleanUid);
    const profile = existing ?? {
      uid: cleanUid,
      displayName: '',
      photoURL: '',
      provider: '',
      ...DEFAULT_PROFILE,
      weeklyWins: 0,
      weeklyGames: 0,
      createdAt: new Date().toISOString(),
    };

    const cleanName = this.#sanitize(displayName, 24);
    const cleanPhoto = this.#sanitize(photoURL, 500);
    const cleanProvider = this.#sanitize(provider, 16);
    if (cleanName) profile.displayName = cleanName;
    if (cleanPhoto) profile.photoURL = cleanPhoto;
    if (cleanProvider) profile.provider = cleanProvider;

    this.profiles.set(cleanUid, profile);
    this.#save();
    return { ...profile };
  }

  get(uid) {
    return this.profiles.get(this.#sanitize(uid, 64)) ?? null;
  }

  /**
   * تسجيل نتيجة ماتش: عدّاد الأبدية + عدّاد الأسبوع + مكافأة كوينز
   * (فوز = 100 كوينز، خسارة = 25).
   */
  recordResult(uid, won) {
    const profile = this.get(uid);
    if (!profile) return null;
    profile.totalGames += 1;
    profile.weeklyGames += 1;
    if (won) {
      profile.wins += 1;
      profile.weeklyWins += 1;
      profile.coins += 100;
    } else {
      profile.coins += 25;
    }
    this.#save();
    return { ...profile };
  }

  /** أعلى 10 لاعبين الأسبوع ده: انتصارات أسبوعية ← نسبة فوز ← انتصارات كلية */
  topPlayers(limit = 10) {
    this.#rollWeekIfNeeded();
    const winRate = (p) => (p.totalGames > 0 ? p.wins / p.totalGames : 0);
    return [...this.profiles.values()]
      .sort(
        (a, b) =>
          b.weeklyWins - a.weeklyWins ||
          winRate(b) - winRate(a) ||
          b.wins - a.wins,
      )
      .slice(0, limit)
      .map((p) => ({
        uid: p.uid,
        displayName: p.displayName || 'لاعب سري',
        photoURL: p.photoURL || '',
        rank: p.rank,
        coins: p.coins,
        wins: p.wins,
        totalGames: p.totalGames,
        weeklyWins: p.weeklyWins,
        weeklyGames: p.weeklyGames,
      }));
  }

  weekInfo() {
    this.#rollWeekIfNeeded();
    return { weekKey: this.weekKey };
  }
}

export const profileStore = new ProfileStore();
