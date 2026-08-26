'use client';

/**
 * Firebase Firestore profile layer — replaces all server API calls.
 * Every mutation uses runTransaction to prevent race conditions.
 */

import {
  doc,
  getDoc,
  deleteDoc,
  runTransaction,
  query,
  orderBy,
  limit as fbLimit,
  getDocs,
  collection,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import type { PlayerProfile } from '@/context/AuthContext';

const PROFILES = 'profiles';

/* ------------------------------------------------------------------ */
/*  Default profile                                                    */
/* ------------------------------------------------------------------ */

export function defaultProfile(): PlayerProfile {
  const now = new Date().toISOString();
  return {
    schemaVersion: 4,
    playerName: '',
    nameStatus: 'required',
    nameSetAt: null,
    coins: 500,
    gems: 0,
    rank: 'مواطن',
    stats: { games: 0, wins: 0, losses: 0, xp: 0, rolePlays: {} },
    badges: [],
    inventory: ['frame-classic'],
    equipped: { cardFrame: 'frame-classic', title: null, emote: null, background: null },
    dailyGift: { lastDay: null, streak: 0 },
    loginCalendar: { monthKey: now.slice(0, 7), claimedDays: [] },
    dailyQuests: { dayKey: now.slice(0, 10), progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] },
    claimedLevelRewards: [],
    processedResults: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function db() {
  if (!firebaseDb) throw new Error('Firestore غير متاح');
  return firebaseDb;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date(Date.now() - 86400000);
  return d.toISOString().slice(0, 10);
}

function currentWeekKey() {
  const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Catalog mirror — client-side pricing (must match server catalog)    */
/* ------------------------------------------------------------------ */

const CATALOG: Record<string, { price: number; currency: 'coins' | 'gems'; type: string; rarity: string; odds?: Record<string, number> }> = {
  'frame-classic':  { price: 0,    currency: 'coins', type: 'cardFrame', rarity: 'common' },
  'frame-blood':    { price: 350,  currency: 'coins', type: 'cardFrame', rarity: 'rare' },
  'frame-gold':     { price: 900,  currency: 'coins', type: 'cardFrame', rarity: 'epic' },
  'frame-neon':     { price: 650,  currency: 'coins', type: 'cardFrame', rarity: 'rare' },
  'frame-ice':      { price: 500,  currency: 'coins', type: 'cardFrame', rarity: 'rare' },
  'frame-emerald':  { price: 750,  currency: 'coins', type: 'cardFrame', rarity: 'epic' },
  'frame-noir':     { price: 450,  currency: 'coins', type: 'cardFrame', rarity: 'rare' },
  'frame-royal':    { price: 1400, currency: 'coins', type: 'cardFrame', rarity: 'legendary' },
  'frame-venom':    { price: 850,  currency: 'coins', type: 'cardFrame', rarity: 'epic' },
  'frame-inferno':  { price: 1200, currency: 'coins', type: 'cardFrame', rarity: 'legendary' },
  'frame-pharaoh':  { price: 20,   currency: 'gems',  type: 'cardFrame', rarity: 'legendary' },
  'frame-void':     { price: 30,   currency: 'gems',  type: 'cardFrame', rarity: 'legendary' },
  'title-detective':{ price: 400,  currency: 'coins', type: 'title', rarity: 'rare' },
  'title-don':      { price: 1000, currency: 'coins', type: 'title', rarity: 'epic' },
  'title-ghost':    { price: 600,  currency: 'coins', type: 'title', rarity: 'rare' },
  'title-godfather':{ price: 750,  currency: 'coins', type: 'title', rarity: 'epic' },
  'title-king':     { price: 25,   currency: 'gems',  type: 'title', rarity: 'legendary' },
  'emote-shush':    { price: 300,  currency: 'coins', type: 'emote', rarity: 'rare' },
  'emote-target':   { price: 350,  currency: 'coins', type: 'emote', rarity: 'rare' },
  'emote-fire':     { price: 450,  currency: 'coins', type: 'emote', rarity: 'epic' },
  'emote-skull':    { price: 550,  currency: 'coins', type: 'emote', rarity: 'epic' },
  'emote-money':    { price: 400,  currency: 'coins', type: 'emote', rarity: 'rare' },
  'emote-clap-gold':{ price: 18,   currency: 'gems',  type: 'emote', rarity: 'legendary' },
  'bg-city':        { price: 500,  currency: 'coins', type: 'background', rarity: 'rare' },
  'bg-blood-moon':  { price: 700,  currency: 'coins', type: 'background', rarity: 'epic' },
  'bg-casino':      { price: 800,  currency: 'coins', type: 'background', rarity: 'epic' },
  'bg-royal':       { price: 10,   currency: 'gems',  type: 'background', rarity: 'legendary' },
  'box-basic':      { price: 400,  currency: 'coins', type: 'lootBox', rarity: 'rare', odds: { common: 55, rare: 30, epic: 12, legendary: 3 } },
  'box-golden':     { price: 5,    currency: 'gems',  type: 'lootBox', rarity: 'epic', odds: { common: 0, rare: 45, epic: 38, legendary: 17 } },
  'box-legendary':  { price: 15,   currency: 'gems',  type: 'lootBox', rarity: 'legendary', odds: { common: 0, rare: 30, epic: 45, legendary: 25 } },
};

const CONVERT_RATE = { coins: 500, gems: 5 };

const DAILY_GIFT = { baseCoins: 100, streakCoinsPerDay: 25, streakMaxDay: 6, gemsEveryDays: 7, gemsAmount: 5 };

const DAILY_QUESTS = [
  { id: 'play-1', metric: 'games' as const, target: 1, rewardCoins: 75, rewardXp: 50, rewardGems: 0 },
  { id: 'play-3', metric: 'games' as const, target: 3, rewardCoins: 150, rewardXp: 100, rewardGems: 0 },
  { id: 'win-1', metric: 'wins' as const, target: 1, rewardCoins: 125, rewardXp: 125, rewardGems: 1 },
  { id: 'survive-1', metric: 'survivals' as const, target: 1, rewardCoins: 100, rewardXp: 75, rewardGems: 0 },
];
const QUEST_BY_ID = new Map(DAILY_QUESTS.map((q) => [q.id, q]));

const LOGIN_CALENDAR = [
  { day: 1,  type: 'coins' as const, amount: 100 },
  { day: 2,  type: 'coins' as const, amount: 125 },
  { day: 3,  type: 'gems' as const,  amount: 2 },
  { day: 4,  type: 'coins' as const, amount: 150 },
  { day: 5,  type: 'coins' as const, amount: 175 },
  { day: 6,  type: 'gems' as const,  amount: 3 },
  { day: 7,  type: 'item' as const,  amount: 0, itemId: 'frame-blood', category: 'cardFrame' },
  { day: 8,  type: 'coins' as const, amount: 200 },
  { day: 9,  type: 'coins' as const, amount: 225 },
  { day: 10, type: 'gems' as const,  amount: 4 },
  { day: 11, type: 'coins' as const, amount: 250 },
  { day: 12, type: 'coins' as const, amount: 275 },
  { day: 13, type: 'gems' as const,  amount: 5 },
  { day: 14, type: 'item' as const,  amount: 0, itemId: 'bg-city', category: 'background' },
  { day: 15, type: 'coins' as const, amount: 300 },
  { day: 16, type: 'coins' as const, amount: 325 },
  { day: 17, type: 'gems' as const,  amount: 6 },
  { day: 18, type: 'coins' as const, amount: 350 },
  { day: 19, type: 'coins' as const, amount: 375 },
  { day: 20, type: 'gems' as const,  amount: 7 },
  { day: 21, type: 'item' as const,  amount: 0, itemId: 'frame-neon', category: 'cardFrame' },
  { day: 22, type: 'coins' as const, amount: 400 },
  { day: 23, type: 'coins' as const, amount: 425 },
  { day: 24, type: 'gems' as const,  amount: 8 },
  { day: 25, type: 'coins' as const, amount: 450 },
  { day: 26, type: 'coins' as const, amount: 475 },
  { day: 27, type: 'gems' as const,  amount: 10 },
  { day: 28, type: 'item' as const,  amount: 0, itemId: 'bg-blood-moon', category: 'background' },
  { day: 29, type: 'coins' as const, amount: 600 },
  { day: 30, type: 'item' as const,  amount: 0, itemId: 'frame-gold', category: 'cardFrame' },
];
const LOGIN_BY_DAY = new Map(LOGIN_CALENDAR.map((e) => [e.day, e]));

/* ------------------------------------------------------------------ */
/*  Level / XP helpers                                                 */
/* ------------------------------------------------------------------ */

const LEVEL_REWARDS = [
  { level: 2,  coins: 150 },
  { level: 3,  gems: 3 },
  { level: 5,  coins: 400, items: ['frame-blood'] },
  { level: 10, gems: 10, items: ['title-detective'] },
  { level: 15, coins: 1000, items: ['bg-city'] },
  { level: 20, gems: 20, items: ['frame-gold'] },
  { level: 30, coins: 2500, gems: 30, items: ['bg-blood-moon'] },
];

function xpForLevel(level: number) {
  return 250 + Math.max(0, level - 1) * 100;
}

function levelForXp(totalXp: number) {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let spent = 0;
  while (level < 100 && xp >= spent + xpForLevel(level)) {
    spent += xpForLevel(level);
    level += 1;
  }
  return level;
}

function grantLevelRewards(draft: PlayerProfile): number[] {
  const level = levelForXp(draft.stats.xp);
  const claimed = new Set(draft.claimedLevelRewards ?? []);
  const granted: number[] = [];
  for (const reward of LEVEL_REWARDS) {
    if (reward.level > level || claimed.has(reward.level)) continue;
    draft.coins += reward.coins ?? 0;
    draft.gems += reward.gems ?? 0;
    if (reward.items) draft.inventory = [...new Set([...draft.inventory, ...reward.items])];
    claimed.add(reward.level);
    granted.push(reward.level);
  }
  draft.claimedLevelRewards = [...claimed].sort((a, b) => a - b);
  return granted;
}

/* ------------------------------------------------------------------ */
/*  Daily deals (deterministic from dayKey)                             */
/* ------------------------------------------------------------------ */

const DEAL_DISCOUNT = 0.3;
const DEAL_PRICE_MIN = 300;

function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DailyDeal { itemId: string; price: number; originalPrice: number }

export function dailyDeals(dayKey: string, count = 3): DailyDeal[] {
  const eligible = Object.entries(CATALOG)
    .filter(([, v]) => v.type !== 'lootBox' && v.price >= DEAL_PRICE_MIN && v.currency !== 'gems')
    .map(([id, v]) => ({ id, price: v.price }));
  const picks: DailyDeal[] = [];
  let seed = hashSeed(`mafia-deals:${dayKey}`);
  const pool = [...eligible];
  while (picks.length < count && pool.length > 0) {
    seed = (Math.imul(seed, 48271) + 11) >>> 0;
    const picked = pool.splice(seed % pool.length, 1)[0];
    picks.push({ itemId: picked.id, price: Math.round(picked.price * (1 - DEAL_DISCOUNT)), originalPrice: picked.price });
  }
  return picks;
}

function dealPriceFor(itemId: string, dayKey: string): number | null {
  const deal = dailyDeals(dayKey).find((d) => d.itemId === itemId);
  return deal ? deal.price : null;
}

/* ------------------------------------------------------------------ */
/*  Daily info (replaces server /api/store/daily)                       */
/* ------------------------------------------------------------------ */

export interface DailyInfo {
  dayKey: string;
  deals: DailyDeal[];
  gift: { claimable: boolean; streak: number; canKeepStreak: boolean; nextCoins: number; nextGems: number };
}

export function buildDailyInfo(profile: PlayerProfile): DailyInfo {
  const today = todayKey();
  const deals = dailyDeals(today);
  const streak = profile.dailyGift?.lastDay === yesterdayKey() ? (profile.dailyGift?.streak ?? 0) + 1 : 1;
  return {
    dayKey: today,
    deals,
    gift: {
      claimable: profile.dailyGift?.lastDay !== today,
      streak: profile.dailyGift?.streak ?? 0,
      canKeepStreak: profile.dailyGift?.lastDay === yesterdayKey(),
      nextCoins: DAILY_GIFT.baseCoins + DAILY_GIFT.streakCoinsPerDay * Math.min(streak - 1, DAILY_GIFT.streakMaxDay),
      nextGems: streak % DAILY_GIFT.gemsEveryDays === 0 ? DAILY_GIFT.gemsAmount : 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Profile CRUD                                                       */
/* ------------------------------------------------------------------ */

export async function fetchProfile(uid: string): Promise<PlayerProfile | null> {
  const snap = await getDoc(doc(db(), PROFILES, uid));
  return snap.exists() ? (snap.data() as PlayerProfile) : null;
}

export async function upsertProfile(
  uid: string,
  data: { displayName?: string; photoURL?: string; provider?: string },
): Promise<PlayerProfile> {
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const snap = await tx.get(ref);
    const now = new Date().toISOString();
    if (snap.exists()) {
      const existing = snap.data() as PlayerProfile;
      const updates: Record<string, unknown> = { updatedAt: now };
      if (data.displayName) updates.displayName = data.displayName;
      if (data.photoURL) updates.photoURL = data.photoURL;
      if (data.provider) updates.provider = data.provider;
      tx.update(ref, updates);
      return { ...existing, ...updates } as PlayerProfile;
    }
    const fresh = defaultProfile();
    tx.set(ref, fresh as unknown as Record<string, unknown>);
    return fresh;
  });
}

export async function deleteProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db(), PROFILES, uid));
}

export async function updatePlayerName(uid: string, name: string): Promise<PlayerProfile> {
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('PROFILE_NOT_FOUND');
    const p = snap.data() as PlayerProfile;
    const now = new Date().toISOString();
    tx.update(ref, { playerName: name, nameStatus: 'set', nameSetAt: now, updatedAt: now });
    return { ...p, playerName: name, nameStatus: 'set', nameSetAt: now } as PlayerProfile;
  });
}

/* ------------------------------------------------------------------ */
/*  Store mutations                                                     */
/* ------------------------------------------------------------------ */

export async function purchaseFirestore(uid: string, itemId: string): Promise<PlayerProfile> {
  const item = CATALOG[itemId];
  if (!item || item.type === 'lootBox') throw new Error('ITEM_NOT_FOUND');
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const p = (await tx.get(ref)).data() as PlayerProfile;
    const day = todayKey();
    const price = item.currency === 'coins' ? (dealPriceFor(itemId, day) ?? item.price) : item.price;
    if (p.inventory.includes(itemId)) throw new Error('ALREADY_OWNED');
    if (item.currency === 'gems') {
      if (p.gems < price) throw new Error('INSUFFICIENT_GEMS');
    } else {
      if (p.coins < price) throw new Error('INSUFFICIENT_COINS');
    }
    const next: PlayerProfile = {
      ...p,
      coins: item.currency === 'coins' ? p.coins - price : p.coins,
      gems: item.currency === 'gems' ? p.gems - price : p.gems,
      inventory: [...p.inventory, itemId],
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next as unknown as Record<string, unknown>);
    return next;
  });
}

export async function equipFirestore(uid: string, itemId: string): Promise<PlayerProfile> {
  const item = CATALOG[itemId];
  if (!item || item.type === 'lootBox') throw new Error('ITEM_NOT_FOUND');
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const p = (await tx.get(ref)).data() as PlayerProfile;
    if (!p.inventory.includes(itemId)) throw new Error('ITEM_NOT_OWNED');
    const next: PlayerProfile = {
      ...p,
      equipped: { ...p.equipped, [item.type]: itemId },
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next as unknown as Record<string, unknown>);
    return next;
  });
}

/* ------------------------------------------------------------------ */
/*  Loot box                                                           */
/* ------------------------------------------------------------------ */

export interface BoxResult {
  won: string | null;
  rarity: string | null;
  refund: number | null;
  refundCurrency: 'coins' | 'gems' | null;
}

function drawLoot(inventory: string[], box: { odds: Record<string, number>; price: number; currency: string }): { type: 'item'; id: string; rarity: string } | { type: 'refund'; amount: number; currency: string } {
  const rarities = ['common', 'rare', 'epic', 'legendary'];
  const available = Object.entries(CATALOG).filter(([id, v]) => v.type !== 'lootBox' && !inventory.includes(id));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let roll = Math.random() * 100;
    let picked: string | null = null;
    for (const r of rarities) {
      const w = box.odds[r] ?? 0;
      if (roll < w) { picked = r; break; }
      roll -= w;
    }
    if (!picked) continue;
    const candidates = available.filter(([, v]) => v.rarity === picked);
    if (candidates.length > 0) {
      const picked_item = candidates[Math.floor(Math.random() * candidates.length)];
      return { type: 'item', id: picked_item[0], rarity: picked_item[1].rarity };
    }
  }
  if (available.length > 0) {
    const picked_item = available[Math.floor(Math.random() * available.length)];
    return { type: 'item', id: picked_item[0], rarity: picked_item[1].rarity };
  }
  return { type: 'refund', amount: Math.max(1, Math.floor(box.price / 2)), currency: box.currency };
}

export async function openBoxFirestore(uid: string, boxId: string): Promise<BoxResult> {
  const box = CATALOG[boxId];
  if (!box || box.type !== 'lootBox' || !box.odds) throw new Error('ITEM_NOT_FOUND');
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const p = (await tx.get(ref)).data() as PlayerProfile;
    if (box.currency === 'gems') {
      if (p.gems < box.price) throw new Error('INSUFFICIENT_GEMS');
    } else {
      if (p.coins < box.price) throw new Error('INSUFFICIENT_COINS');
    }
    const roll = drawLoot(p.inventory, { odds: box.odds!, price: box.price, currency: box.currency });
    let next: PlayerProfile;
    if (roll.type === 'item') {
      next = {
        ...p,
        coins: box.currency === 'coins' ? p.coins - box.price : p.coins,
        gems: box.currency === 'gems' ? p.gems - box.price : p.gems,
        inventory: [...p.inventory, roll.id],
        updatedAt: new Date().toISOString(),
      };
      tx.set(ref, next as unknown as Record<string, unknown>);
      return { won: roll.id, rarity: roll.rarity, refund: null, refundCurrency: null };
    }
    next = {
      ...p,
      coins: box.currency === 'coins' ? p.coins - box.price + roll.amount : p.coins,
      gems: box.currency === 'gems' ? p.gems - box.price + roll.amount : p.gems,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next as unknown as Record<string, unknown>);
    return { won: null, rarity: null, refund: roll.amount, refundCurrency: roll.currency as 'coins' | 'gems' };
  });
}

/* ------------------------------------------------------------------ */
/*  Daily gift                                                         */
/* ------------------------------------------------------------------ */

export async function claimDailyGiftFirestore(uid: string): Promise<PlayerProfile> {
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const p = (await tx.get(ref)).data() as PlayerProfile;
    const today = todayKey();
    if (p.dailyGift?.lastDay === today) throw new Error('DAILY_CLAIMED');
    const streak = p.dailyGift?.lastDay === yesterdayKey() ? (p.dailyGift?.streak ?? 0) + 1 : 1;
    const coins = DAILY_GIFT.baseCoins + DAILY_GIFT.streakCoinsPerDay * Math.min(streak - 1, DAILY_GIFT.streakMaxDay);
    const gems = streak % DAILY_GIFT.gemsEveryDays === 0 ? DAILY_GIFT.gemsAmount : 0;
    const next: PlayerProfile = {
      ...p,
      dailyGift: { lastDay: today, streak },
      coins: p.coins + coins,
      gems: p.gems + gems,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next as unknown as Record<string, unknown>);
    return next;
  });
}

/* ------------------------------------------------------------------ */
/*  Quest claim                                                        */
/* ------------------------------------------------------------------ */

export async function claimQuestFirestore(uid: string, questId: string): Promise<PlayerProfile> {
  const quest = QUEST_BY_ID.get(questId);
  if (!quest) throw new Error('QUEST_NOT_FOUND');
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const p = (await tx.get(ref)).data() as PlayerProfile;
    const today = todayKey();
    const dq = p.dailyQuests?.dayKey === today
      ? p.dailyQuests
      : { dayKey: today, progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] };
    if (dq.claimed.includes(questId)) throw new Error('QUEST_CLAIMED');
    if ((dq.progress[quest.metric] ?? 0) < quest.target) throw new Error('QUEST_INCOMPLETE');
    const next: PlayerProfile = {
      ...p,
      dailyQuests: { ...dq, claimed: [...dq.claimed, questId] },
      coins: p.coins + quest.rewardCoins,
      gems: p.gems + (quest.rewardGems ?? 0),
      stats: { ...p.stats, xp: p.stats.xp + quest.rewardXp },
      updatedAt: new Date().toISOString(),
    };
    grantLevelRewards(next);
    tx.set(ref, next as unknown as Record<string, unknown>);
    return next;
  });
}

/* ------------------------------------------------------------------ */
/*  Login reward                                                       */
/* ------------------------------------------------------------------ */

export async function claimLoginRewardFirestore(uid: string, day: number): Promise<PlayerProfile> {
  const reward = LOGIN_BY_DAY.get(day);
  if (!reward) throw new Error('LOGIN_REWARD_NOT_FOUND');
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const p = (await tx.get(ref)).data() as PlayerProfile;
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    const today = Math.min(30, now.getUTCDate());
    const cal = p.loginCalendar?.monthKey === monthKey
      ? p.loginCalendar
      : { monthKey, claimedDays: [] };
    if (day !== today) throw new Error('LOGIN_REWARD_LOCKED');
    if (cal.claimedDays.includes(day)) throw new Error('LOGIN_REWARD_CLAIMED');
    const expectedDay = cal.claimedDays.length === 0 ? today : Math.max(...cal.claimedDays) + 1;
    if (day !== expectedDay) throw new Error('LOGIN_REWARD_SEQUENCE');
    let coins = p.coins;
    let gems = p.gems;
    let inventory = p.inventory;
    if (reward.type === 'coins') coins += reward.amount;
    else if (reward.type === 'gems') gems += reward.amount;
    else if (reward.type === 'item' && reward.itemId) {
      inventory = [...new Set([...inventory, reward.itemId])];
    }
    const next: PlayerProfile = {
      ...p,
      coins,
      gems,
      inventory,
      loginCalendar: { monthKey, claimedDays: [...cal.claimedDays, day] },
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next as unknown as Record<string, unknown>);
    return next;
  });
}

/* ------------------------------------------------------------------ */
/*  Coin → Gem conversion                                              */
/* ------------------------------------------------------------------ */

export async function convertCoinsFirestore(uid: string): Promise<PlayerProfile> {
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const p = (await tx.get(ref)).data() as PlayerProfile;
    if (p.coins < CONVERT_RATE.coins) throw new Error('INSUFFICIENT_COINS');
    const next: PlayerProfile = {
      ...p,
      coins: p.coins - CONVERT_RATE.coins,
      gems: p.gems + CONVERT_RATE.gems,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, next as unknown as Record<string, unknown>);
    return next;
  });
}

/* ------------------------------------------------------------------ */
/*  Game result                                                        */
/* ------------------------------------------------------------------ */

const GEM_REWARDS = { winAlive: 1, badgeFirstWin: 5, badgeVeteran: 10, badgeNightOwl: 25 };

export async function recordGameResultFirestore(
  uid: string,
  result: { idempotencyKey: string; winner: string; playerTeam: string; role: string; alive: boolean },
): Promise<PlayerProfile | null> {
  return runTransaction(db(), async (tx) => {
    const ref = doc(db(), PROFILES, uid);
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const p = snap.data() as PlayerProfile;
    if (p.processedResults?.includes(result.idempotencyKey)) return p;
    const won = result.winner === result.playerTeam;
    const alive = Boolean(result.alive);
    const reward = won ? (alive ? 120 : 100) : alive ? 30 : 25;
    const xp = won
      ? (alive ? 120 : 80)
      : (alive ? 25 : 15);
    let gemReward = won && alive ? GEM_REWARDS.winAlive : 0;
    const newBadges: string[] = [];
    const had = (b: string) => p.badges.includes(b);
    if (p.stats.games + 1 >= 1 && !had('first-game')) newBadges.push('first-game');
    if ((p.stats.wins + (won ? 1 : 0)) >= 1 && !had('first-win') && won) newBadges.push('first-win');
    if ((p.stats.wins + (won ? 1 : 0)) >= 10 && !had('veteran-10') && won) newBadges.push('veteran-10');
    if ((p.stats.games + 1) >= 50 && !had('night-owl-50')) newBadges.push('night-owl-50');
    if (newBadges.includes('first-win')) gemReward += GEM_REWARDS.badgeFirstWin;
    if (newBadges.includes('veteran-10')) gemReward += GEM_REWARDS.badgeVeteran;
    if (newBadges.includes('night-owl-50')) gemReward += GEM_REWARDS.badgeNightOwl;
    const today = todayKey();
    const dq = p.dailyQuests?.dayKey === today
      ? { ...p.dailyQuests }
      : { dayKey: today, progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] };
    dq.progress.games += 1;
    if (won) dq.progress.wins += 1;
    if (alive) dq.progress.survivals += 1;
    const next: PlayerProfile = {
      ...p,
      stats: {
        ...p.stats,
        games: p.stats.games + 1,
        wins: p.stats.wins + (won ? 1 : 0),
        losses: p.stats.losses + (won ? 0 : 1),
        xp: p.stats.xp + xp,
        rolePlays: { ...p.stats.rolePlays, [result.role]: (p.stats.rolePlays[result.role] ?? 0) + 1 },
      },
      coins: p.coins + reward,
      gems: p.gems + gemReward,
      badges: [...new Set([...p.badges, ...newBadges])],
      dailyQuests: dq,
      processedResults: [...(p.processedResults ?? []), result.idempotencyKey].slice(-200),
      updatedAt: new Date().toISOString(),
    };
    grantLevelRewards(next);
    tx.set(ref, next as unknown as Record<string, unknown>);
    return next;
  });
}

/* ------------------------------------------------------------------ */
/*  Leaderboard                                                        */
/* ------------------------------------------------------------------ */

export interface LeaderRow {
  uid: string;
  displayName: string;
  photoURL: string;
  rank: string;
  coins: number;
  gems: number;
  wins: number;
  totalGames: number;
  badges: string[];
  equipped: PlayerProfile['equipped'];
}

export async function fetchLeaderboard(): Promise<{ weekKey: string; players: LeaderRow[] }> {
  const q = query(collection(db(), PROFILES), orderBy('stats.wins', 'desc'), fbLimit(10));
  const snap = await getDocs(q);
  const players: LeaderRow[] = snap.docs.map((d) => {
    const p = d.data() as PlayerProfile;
    return {
      uid: d.id,
      displayName: p.stats ? (p as unknown as Record<string, string>).displayName ?? 'لاعب سري' : 'لاعب سري',
      photoURL: (p as unknown as Record<string, string>).photoURL ?? '',
      rank: p.rank ?? 'مواطن',
      coins: p.coins,
      gems: p.gems,
      wins: p.stats.wins,
      totalGames: p.stats.games,
      badges: p.badges,
      equipped: p.equipped,
    };
  });
  return { weekKey: currentWeekKey(), players };
}
