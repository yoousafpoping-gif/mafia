import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';
import { CATALOG_BY_ID, COSMETIC_CATALOG, CONVERT_RATE, DAILY_GIFT, DAILY_QUEST_BY_ID, GEM_REWARDS, LOGIN_REWARD_BY_DAY, PROGRESSION, currentDayKey, dailyDeals, dealPriceFor, levelForXp } from './catalog.js';
import { requirePlayerName } from './playerName.js';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'profiles.json');
const MAX_LEDGER = 500;

function currentWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function yesterdayKey(date = new Date()) {
  return currentDayKey(new Date(date.getTime() - 86400000));
}

function cleanString(value, maxLen) {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

function clone(value) {
  return structuredClone(value);
}

function defaultProfile(uid) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    uid,
    displayName: '',
    playerName: '',
    nameStatus: 'required',
    nameSetAt: null,
    photoURL: '',
    provider: 'google',
    avatar: { kind: 'photo', value: '' },
    rank: 'مواطن',
    coins: 500,
    gems: 0,
    stats: { games: 0, wins: 0, losses: 0, xp: 0, rolePlays: {} },
    weeklyWins: 0,
    weeklyGames: 0,
    badges: [],
    inventory: ['frame-classic'],
    equipped: { cardFrame: 'frame-classic', title: null, emote: null, background: null },
    dailyGift: { lastDay: null, streak: 0 },
    loginCalendar: { monthKey: new Date().toISOString().slice(0, 7), claimedDays: [] },
    dailyQuests: { dayKey: currentDayKey(), progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] },
    claimedLevelRewards: [],
    ledger: [{ id: 'welcome', type: 'WELCOME', amount: 500, balance: 500, at: now }],
    transactions: { welcome: { type: 'WELCOME', at: now } },
    createdAt: now,
    updatedAt: now,
  };
}

function migrateProfile(raw) {
  const uid = cleanString(raw?.uid, 128);
  if (!uid) return null;
  const profile = { ...defaultProfile(uid), ...raw };
  // schemaVersion 2 هو أول مخزن server-authoritative. أي سجل أقدم قد يكون
  // مستوردًا من localStorage، لذلك لا نثق في coins/stats منه.
  const trustedEconomy = Number(raw?.schemaVersion) >= 2;
  const games = trustedEconomy ? Number(raw?.stats?.games ?? 0) || 0 : 0;
  const wins = trustedEconomy ? Number(raw?.stats?.wins ?? 0) || 0 : 0;
  profile.stats = {
    games: Math.max(0, games),
    wins: Math.max(0, Math.min(wins, games)),
    losses: trustedEconomy ? Math.max(0, Number(raw?.stats?.losses ?? games - wins) || 0) : 0,
    xp: trustedEconomy ? Math.max(0, Number(raw?.stats?.xp ?? 0) || 0) : 0,
    rolePlays: trustedEconomy && raw?.stats?.rolePlays && typeof raw.stats.rolePlays === 'object' ? raw.stats.rolePlays : {},
  };
  profile.coins = trustedEconomy ? Math.max(0, Number(raw?.coins ?? 500) || 0) : 500;
  profile.gems = trustedEconomy ? Math.max(0, Number(raw?.gems ?? 0) || 0) : 0;
  profile.badges = Array.isArray(raw?.badges) ? [...new Set(raw.badges.filter((x) => typeof x === 'string'))] : [];
  profile.inventory = Array.isArray(raw?.inventory) ? [...new Set(['frame-classic', ...raw.inventory])] : ['frame-classic'];
  profile.equipped = { cardFrame: 'frame-classic', title: null, emote: null, background: null, ...(raw?.equipped ?? {}) };
  profile.dailyGift = {
    lastDay: cleanString(raw?.dailyGift?.lastDay, 10) || null,
    streak: Math.max(0, Number(raw?.dailyGift?.streak ?? 0) || 0),
  };
  const today = currentDayKey();
  const monthKey = today.slice(0, 7);
  profile.loginCalendar = raw?.loginCalendar?.monthKey === monthKey
    ? {
        monthKey,
        claimedDays: Array.isArray(raw.loginCalendar?.claimedDays)
          ? [...new Set(raw.loginCalendar.claimedDays.filter((day) => Number.isInteger(day) && day >= 1 && day <= 30))]
          : [],
      }
    : { monthKey, claimedDays: [] };
  profile.dailyQuests = raw?.dailyQuests?.dayKey === today
    ? {
        dayKey: today,
        progress: {
          games: Math.max(0, Number(raw.dailyQuests?.progress?.games ?? 0) || 0),
          wins: Math.max(0, Number(raw.dailyQuests?.progress?.wins ?? 0) || 0),
          survivals: Math.max(0, Number(raw.dailyQuests?.progress?.survivals ?? 0) || 0),
        },
        claimed: Array.isArray(raw.dailyQuests?.claimed)
          ? [...new Set(raw.dailyQuests.claimed.filter((id) => DAILY_QUEST_BY_ID.has(id)))]
          : [],
      }
    : { dayKey: today, progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] };
  profile.claimedLevelRewards = Array.isArray(raw?.claimedLevelRewards)
    ? [...new Set(raw.claimedLevelRewards.filter((level) => Number.isInteger(level) && level > 1))]
    : [];
  profile.ledger = Array.isArray(raw?.ledger) ? raw.ledger.slice(-MAX_LEDGER) : [];
  profile.transactions = raw?.transactions && typeof raw.transactions === 'object' ? raw.transactions : {};
  const playerName = cleanString(raw?.playerName, 16);
  profile.playerName = playerName;
  profile.nameStatus = playerName ? 'set' : 'required';
  profile.nameSetAt = playerName && typeof raw?.nameSetAt === 'string' ? raw.nameSetAt : null;
  profile.schemaVersion = 4;
  return profile;
}

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
      for (const candidate of raw.profiles ?? []) {
        const profile = migrateProfile(candidate);
        if (profile) this.profiles.set(profile.uid, profile);
      }
      this.#save();
      logger.info(`Profile store loaded: ${this.profiles.size} profile(s)`);
    } catch (error) {
      logger.error(`Profile store load failed, starting fresh: ${error.message}`);
    }
  }

  #save() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = `${DATA_FILE}.${process.pid}.tmp`;
    const payload = JSON.stringify({ schemaVersion: 4, weekKey: this.weekKey, profiles: [...this.profiles.values()] }, null, 2);
    fs.writeFileSync(temp, payload, 'utf8');
    fs.renameSync(temp, DATA_FILE);
  }

  #rollWeekIfNeeded() {
    const now = currentWeekKey();
    if (now === this.weekKey) return;
    this.weekKey = now;
    for (const profile of this.profiles.values()) {
      profile.weeklyWins = 0;
      profile.weeklyGames = 0;
    }
    this.#save();
  }

  #transaction(profile, id, type, mutate) {
    const key = cleanString(id, 128);
    if (!key) throw Object.assign(new Error('idempotency key required'), { code: 'IDEMPOTENCY_REQUIRED' });
    if (profile.transactions[key]) return { profile: clone(profile), replayed: true };
    const before = clone(profile);
    try {
      const ledgerEntry = mutate(profile);
      profile.updatedAt = new Date().toISOString();
      profile.transactions[key] = { type, at: profile.updatedAt };
      if (ledgerEntry) profile.ledger = [...profile.ledger, { id: key, type, at: profile.updatedAt, ...ledgerEntry }].slice(-MAX_LEDGER);
      this.#save();
      return { profile: clone(profile), replayed: false };
    } catch (error) {
      this.profiles.set(profile.uid, before);
      throw error;
    }
  }

  /** استرجاع metadata من الـ ledger — عشان الرد يتكرر صح حتى لو الطلب اتعاد (replay) */
  #ledgerMeta(profile, key) {
    return profile.ledger.find((entry) => entry.id === key) ?? {};
  }

  #grantLevelRewards(draft) {
    const level = levelForXp(draft.stats.xp);
    const claimed = new Set(draft.claimedLevelRewards ?? []);
    const granted = [];
    for (const reward of PROGRESSION.levelRewards) {
      if (reward.level > level || claimed.has(reward.level)) continue;
      draft.coins += reward.coins ?? 0;
      draft.gems += reward.gems ?? 0;
      draft.inventory = [...new Set([...draft.inventory, ...(reward.items ?? [])])];
      claimed.add(reward.level);
      granted.push(reward.level);
    }
    draft.claimedLevelRewards = [...claimed].sort((a, b) => a - b);
    return granted;
  }

  upsert({ uid, displayName, photoURL, provider = 'google' }) {
    const cleanUid = cleanString(uid, 128);
    if (!cleanUid) throw new Error('uid required');
    const profile = this.profiles.get(cleanUid) ?? defaultProfile(cleanUid);
    const name = cleanString(displayName, 32);
    const photo = cleanString(photoURL, 500);
    if (name) profile.displayName = name;
    if (photo) {
      profile.photoURL = photo;
      profile.avatar = { kind: 'photo', value: photo };
    }
    profile.provider = cleanString(provider, 24) || 'google';
    profile.updatedAt = new Date().toISOString();
    this.profiles.set(cleanUid, profile);
    this.#save();
    return clone(profile);
  }

  get(uid) {
    const profile = this.profiles.get(cleanString(uid, 128));
    return profile ? clone(profile) : null;
  }

  /** حذف بروفايل اللاعب نهائياً (حذف الحساب) — بيرجع true لو كان موجود فعلاً واتمسح */
  remove(uid) {
    const cleanUid = cleanString(uid, 128);
    if (!cleanUid) return false;
    const deleted = this.profiles.delete(cleanUid);
    if (deleted) this.#save();
    return deleted;
  }

  setPlayerName(uid, rawName) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const playerName = requirePlayerName(rawName);
    profile.playerName = playerName;
    profile.nameStatus = 'set';
    profile.nameSetAt = new Date().toISOString();
    profile.updatedAt = profile.nameSetAt;
    this.#save();
    return clone(profile);
  }

  recordResult(uid, result) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const won = result.winner === result.playerTeam;
    const alive = Boolean(result.alive);
    const reward = won ? (alive ? 120 : 100) : alive ? 30 : 25;
    const xp = won
      ? (alive ? PROGRESSION.gameXp.winAlive : PROGRESSION.gameXp.winEliminated)
      : (alive ? PROGRESSION.gameXp.lossAlive : PROGRESSION.gameXp.lossEliminated);
    return this.#transaction(profile, result.idempotencyKey, 'GAME_RESULT', (draft) => {
      draft.stats.games += 1;
      draft.stats.wins += won ? 1 : 0;
      draft.stats.losses += won ? 0 : 1;
      draft.stats.xp += xp;
      draft.stats.rolePlays[result.role] = (draft.stats.rolePlays[result.role] ?? 0) + 1;
      draft.weeklyGames += 1;
      draft.weeklyWins += won ? 1 : 0;
      draft.coins += reward;
      const today = currentDayKey();
      if (draft.dailyQuests?.dayKey !== today) {
        draft.dailyQuests = { dayKey: today, progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] };
      }
      draft.dailyQuests.progress.games += 1;
      draft.dailyQuests.progress.wins += won ? 1 : 0;
      draft.dailyQuests.progress.survivals += alive ? 1 : 0;
      // جواهر من اللعب: فوز وأنت حي + شارات الإنجاز
      let gemReward = won && alive ? GEM_REWARDS.winAlive : 0;
      const newBadges = [];
      const had = (badge) => draft.badges.includes(badge);
      if (draft.stats.games >= 1 && !had('first-game')) newBadges.push('first-game');
      if (draft.stats.wins >= 1 && !had('first-win')) newBadges.push('first-win');
      if (draft.stats.wins >= 10 && !had('veteran-10')) newBadges.push('veteran-10');
      if (draft.stats.games >= 50 && !had('night-owl-50')) newBadges.push('night-owl-50');
      if (newBadges.includes('first-win')) gemReward += GEM_REWARDS.badgeFirstWin;
      if (newBadges.includes('veteran-10')) gemReward += GEM_REWARDS.badgeVeteran;
      if (newBadges.includes('night-owl-50')) gemReward += GEM_REWARDS.badgeNightOwl;
      draft.gems += gemReward;
      draft.badges = [...new Set([...draft.badges, ...newBadges])];
      const levelRewards = this.#grantLevelRewards(draft);
      return { amount: reward, xp, gems: gemReward, level: levelForXp(draft.stats.xp), levelRewards, balance: draft.coins, gemBalance: draft.gems, metadata: { won, role: result.role, roomCode: result.roomCode } };
    });
  }

  #priceFor(item) {
    // العروض اليومية تسري فقط على عناصر الكوينز
    if (item.currency === 'gems') return { price: item.price, currency: 'gems', deal: false };
    const deal = dealPriceFor(item.id);
    return deal !== null ? { price: deal, currency: 'coins', deal: true } : { price: item.price, currency: 'coins', deal: false };
  }

  purchase(uid, itemId, idempotencyKey) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const item = CATALOG_BY_ID.get(cleanString(itemId, 64));
    if (!item || item.type === 'lootBox') throw Object.assign(new Error('unknown catalog item'), { code: 'ITEM_NOT_FOUND' });
    const { price, currency, deal } = this.#priceFor(item);
    return this.#transaction(profile, idempotencyKey, 'PURCHASE', (draft) => {
      if (draft.inventory.includes(item.id)) throw Object.assign(new Error('already owned'), { code: 'ALREADY_OWNED' });
      if (currency === 'gems') {
        if (draft.gems < price) throw Object.assign(new Error('insufficient gems'), { code: 'INSUFFICIENT_GEMS' });
        draft.gems -= price;
      } else {
        if (draft.coins < price) throw Object.assign(new Error('insufficient coins'), { code: 'INSUFFICIENT_COINS' });
        draft.coins -= price;
      }
      draft.inventory.push(item.id);
      return { amount: -price, currency, balance: currency === 'gems' ? draft.gems : draft.coins, itemId: item.id, deal };
    });
  }

  equip(uid, itemId, idempotencyKey) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const item = CATALOG_BY_ID.get(cleanString(itemId, 64));
    if (!item || item.type === 'lootBox') throw Object.assign(new Error('unknown catalog item'), { code: 'ITEM_NOT_FOUND' });
    return this.#transaction(profile, idempotencyKey, 'EQUIP', (draft) => {
      if (!draft.inventory.includes(item.id)) throw Object.assign(new Error('item not owned'), { code: 'ITEM_NOT_OWNED' });
      draft.equipped[item.type] = item.id;
      return { amount: 0, balance: draft.coins, itemId: item.id };
    });
  }

  /** صندوق الحظ — سحب موزون بالـ rarity من غير المملوك، ولو كل حاجة مملوكة يترجّع نص السعر */
  openBox(uid, boxId, idempotencyKey) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const box = CATALOG_BY_ID.get(cleanString(boxId, 64));
    if (!box || box.type !== 'lootBox' || !box.odds) throw Object.assign(new Error('unknown loot box'), { code: 'ITEM_NOT_FOUND' });
    const currency = box.currency ?? 'coins';
    const outcome = this.#transaction(profile, idempotencyKey, 'LOOT_BOX', (draft) => {
      if (currency === 'gems') {
        if (draft.gems < box.price) throw Object.assign(new Error('insufficient gems'), { code: 'INSUFFICIENT_GEMS' });
        draft.gems -= box.price;
      } else {
        if (draft.coins < box.price) throw Object.assign(new Error('insufficient coins'), { code: 'INSUFFICIENT_COINS' });
        draft.coins -= box.price;
      }
      const roll = this.#drawLoot(draft, box);
      if (roll.type === 'item') draft.inventory.push(roll.item.id);
      else if (roll.currency === 'gems') draft.gems += roll.amount;
      else draft.coins += roll.amount;
      return roll.type === 'item'
        ? { amount: -box.price, currency, balance: currency === 'gems' ? draft.gems : draft.coins, won: roll.item.id, rarity: roll.item.rarity }
        : { amount: -box.price, currency, balance: currency === 'gems' ? draft.gems : draft.coins, refund: roll.amount, refundCurrency: roll.currency };
    });
    const meta = this.#ledgerMeta(outcome.profile, cleanString(idempotencyKey, 128));
    return { ...outcome, won: meta.won ?? null, rarity: meta.rarity ?? null, refund: meta.refund ?? null, refundCurrency: meta.refundCurrency ?? null };
  }

  #drawLoot(draft, box) {
    const rarities = ['common', 'rare', 'epic', 'legendary'];
    const pool = () => COSMETIC_CATALOG.filter((item) => item.type !== 'lootBox' && !draft.inventory.includes(item.id));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let roll = Math.random() * 100;
      let picked = null;
      for (const rarity of rarities) {
        const weight = box.odds[rarity] ?? 0;
        if (roll < weight) { picked = rarity; break; }
        roll -= weight;
      }
      if (!picked) continue;
      const candidates = pool().filter((item) => item.rarity === picked);
      if (candidates.length > 0) return { type: 'item', item: candidates[Math.floor(Math.random() * candidates.length)] };
    }
    // فشل السحب الموزون (كل النوادر مملوكة مثلًا) — أي عنصر متاح، أو استرداد نص السعر
    const anyLeft = pool();
    if (anyLeft.length > 0) return { type: 'item', item: anyLeft[Math.floor(Math.random() * anyLeft.length)] };
    const refund = Math.max(1, Math.floor(box.price / 2));
    return { type: 'refund', amount: refund, currency: box.currency ?? 'coins' };
  }

  /** الهدية اليومية — سلسلة أيام متتالية تزود الكوينز، وكل 7 أيام جواهر */
  claimDaily(uid, idempotencyKey) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const today = currentDayKey();
    const outcome = this.#transaction(profile, idempotencyKey, 'DAILY_GIFT', (draft) => {
      if (draft.dailyGift.lastDay === today) throw Object.assign(new Error('daily gift already claimed'), { code: 'DAILY_CLAIMED' });
      const streak = draft.dailyGift.lastDay === yesterdayKey() ? draft.dailyGift.streak + 1 : 1;
      const coins = DAILY_GIFT.baseCoins + DAILY_GIFT.streakCoinsPerDay * Math.min(streak - 1, DAILY_GIFT.streakMaxDay);
      const gems = streak % DAILY_GIFT.gemsEveryDays === 0 ? DAILY_GIFT.gemsAmount : 0;
      draft.dailyGift = { lastDay: today, streak };
      draft.coins += coins;
      draft.gems += gems;
      return { amount: coins, gems, balance: draft.coins, streak };
    });
    const meta = this.#ledgerMeta(outcome.profile, cleanString(idempotencyKey, 128));
    return { ...outcome, streak: meta.streak ?? 0 };
  }

  /** تحصيل مهمة يومية مكتملة — المعاملة محمية بمفتاح تكرار وبحالة claimed اليومية. */
  claimQuest(uid, questId, idempotencyKey) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const quest = DAILY_QUEST_BY_ID.get(cleanString(questId, 64));
    if (!quest) throw Object.assign(new Error('unknown daily quest'), { code: 'QUEST_NOT_FOUND' });
    const today = currentDayKey();
    return this.#transaction(profile, idempotencyKey, 'DAILY_QUEST', (draft) => {
      if (draft.dailyQuests?.dayKey !== today) {
        draft.dailyQuests = { dayKey: today, progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] };
      }
      if (draft.dailyQuests.claimed.includes(quest.id)) {
        throw Object.assign(new Error('daily quest already claimed'), { code: 'QUEST_CLAIMED' });
      }
      if ((draft.dailyQuests.progress[quest.metric] ?? 0) < quest.target) {
        throw Object.assign(new Error('daily quest incomplete'), { code: 'QUEST_INCOMPLETE' });
      }
      draft.dailyQuests.claimed.push(quest.id);
      draft.coins += quest.rewardCoins;
      draft.gems += quest.rewardGems ?? 0;
      draft.stats.xp += quest.rewardXp;
      const levelRewards = this.#grantLevelRewards(draft);
      return { amount: quest.rewardCoins, xp: quest.rewardXp, gems: quest.rewardGems ?? 0, level: levelForXp(draft.stats.xp), levelRewards, balance: draft.coins, gemBalance: draft.gems, questId: quest.id };
    });
  }

  /** مكافأة دخول واحدة فقط لليوم الحالي، مع تسلسل الشهر ومنع التكرار. */
  claimLoginReward(uid, rawDay, idempotencyKey) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    const today = Math.min(30, now.getUTCDate());
    const day = Number(rawDay);
    const reward = LOGIN_REWARD_BY_DAY.get(day);
    if (!reward) throw Object.assign(new Error('unknown login reward'), { code: 'LOGIN_REWARD_NOT_FOUND' });
    return this.#transaction(profile, idempotencyKey, 'LOGIN_REWARD', (draft) => {
      if (draft.loginCalendar?.monthKey !== monthKey) draft.loginCalendar = { monthKey, claimedDays: [] };
      if (day !== today) throw Object.assign(new Error('login reward locked'), { code: 'LOGIN_REWARD_LOCKED' });
      if (draft.loginCalendar.claimedDays.includes(day)) throw Object.assign(new Error('login reward already claimed'), { code: 'LOGIN_REWARD_CLAIMED' });
      const expectedDay = draft.loginCalendar.claimedDays.length === 0
        ? today
        : Math.max(...draft.loginCalendar.claimedDays) + 1;
      if (day !== expectedDay) throw Object.assign(new Error('login reward out of sequence'), { code: 'LOGIN_REWARD_SEQUENCE' });
      let coins = 0;
      let gems = 0;
      let itemId = null;
      if (reward.type === 'coins') { coins = reward.amount; draft.coins += coins; }
      else if (reward.type === 'gems') { gems = reward.amount; draft.gems += gems; }
      else {
        const item = CATALOG_BY_ID.get(reward.itemId);
        if (!item || item.type !== reward.category) throw Object.assign(new Error('invalid login reward item'), { code: 'LOGIN_REWARD_NOT_FOUND' });
        itemId = item.id;
        draft.inventory = [...new Set([...draft.inventory, item.id])];
      }
      draft.loginCalendar.claimedDays.push(day);
      return { amount: coins, gems, itemId, day, balance: draft.coins, gemBalance: draft.gems };
    });
  }

  /** تحويل كوينز لجواهر بالفئة الثابتة (500 كوينز → 5 جواهر) */
  convertCoins(uid, idempotencyKey) {
    const profile = this.profiles.get(cleanString(uid, 128));
    if (!profile) return null;
    return this.#transaction(profile, idempotencyKey, 'CONVERT', (draft) => {
      if (draft.coins < CONVERT_RATE.coins) throw Object.assign(new Error('insufficient coins'), { code: 'INSUFFICIENT_COINS' });
      draft.coins -= CONVERT_RATE.coins;
      draft.gems += CONVERT_RATE.gems;
      return { amount: -CONVERT_RATE.coins, gems: CONVERT_RATE.gems, balance: draft.coins, gemBalance: draft.gems };
    });
  }

  /** حالة اليوم للعميل: العروض + الهدية (متصلة أم لا) */
  dailyStatus(uid) {
    const profile = this.profiles.get(cleanString(uid, 128));
    const today = currentDayKey();
    const gift = { claimable: false, streak: 0, canKeepStreak: false, nextCoins: DAILY_GIFT.baseCoins, nextGems: 0 };
    if (profile) {
      const streak = profile.dailyGift.lastDay === yesterdayKey() ? profile.dailyGift.streak + 1 : 1;
      gift.claimable = profile.dailyGift.lastDay !== today;
      gift.streak = profile.dailyGift.streak;
      gift.canKeepStreak = profile.dailyGift.lastDay === yesterdayKey();
      gift.nextCoins = DAILY_GIFT.baseCoins + DAILY_GIFT.streakCoinsPerDay * Math.min(streak - 1, DAILY_GIFT.streakMaxDay);
      gift.nextGems = streak % DAILY_GIFT.gemsEveryDays === 0 ? DAILY_GIFT.gemsAmount : 0;
    }
    return { dayKey: today, deals: dailyDeals(today), gift };
  }

  topPlayers(limit = 10) {
    this.#rollWeekIfNeeded();
    return [...this.profiles.values()]
      .sort((a, b) => b.weeklyWins - a.weeklyWins || (b.stats.wins / Math.max(1, b.stats.games)) - (a.stats.wins / Math.max(1, a.stats.games)))
      .slice(0, limit)
      .map((p) => ({ uid: p.uid, displayName: p.displayName || 'لاعب سري', photoURL: p.photoURL || '', rank: p.rank, coins: p.coins, gems: p.gems, wins: p.stats.wins, totalGames: p.stats.games, weeklyWins: p.weeklyWins, weeklyGames: p.weeklyGames, badges: p.badges, equipped: p.equipped }));
  }

  weekInfo() {
    this.#rollWeekIfNeeded();
    return { weekKey: this.weekKey };
  }
}

export const profileStore = new ProfileStore();
