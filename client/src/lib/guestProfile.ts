import type { PlayerProfile } from '@/context/AuthContext';
import { DAILY_QUESTS, DAILY_REWARD_CONFIG, PROGRESSION_CONFIG, levelProgress } from '@/lib/progressionConfig';
import { LOGIN_REWARD_CALENDAR } from '@/lib/loginRewardsConfig';

const GUEST_PROFILE_KEY = 'mafia-guest-profile-v1';

export function defaultGuestProfile(): PlayerProfile {
  return {
    schemaVersion: 4,
    playerName: '',
    nameStatus: 'required',
    nameSetAt: null,
    coins: 500,
    gems: 0,
    rank: 'ضيف الحارة',
    stats: { games: 0, wins: 0, losses: 0, xp: 0, rolePlays: {} },
    badges: [],
    inventory: ['frame-classic'],
    equipped: { cardFrame: 'frame-classic', title: null, emote: null, background: null },
    dailyGift: { lastDay: null, streak: 0 },
    loginCalendar: { monthKey: monthKey(), claimedDays: [] },
    dailyQuests: { dayKey: dayKey(), progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] },
    claimedLevelRewards: [],
    processedResults: [],
  };
}

export function loadGuestProfile(): PlayerProfile {
  if (typeof window === 'undefined') return defaultGuestProfile();
  try {
    const raw = window.localStorage.getItem(GUEST_PROFILE_KEY);
    if (!raw) return defaultGuestProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const fallback = defaultGuestProfile();
    const playerName = typeof parsed.playerName === 'string' ? parsed.playerName.trim() : '';
    return {
      ...fallback,
      ...parsed,
      schemaVersion: 4,
      playerName,
      nameStatus: playerName ? 'set' : 'required',
      nameSetAt: playerName && typeof parsed.nameSetAt === 'string' ? parsed.nameSetAt : null,
      coins: Math.max(0, Number(parsed.coins ?? fallback.coins) || 0),
      gems: Math.max(0, Number(parsed.gems ?? fallback.gems) || 0),
      stats: { ...fallback.stats, ...(parsed.stats ?? {}) },
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      inventory: Array.isArray(parsed.inventory) ? [...new Set(['frame-classic', ...parsed.inventory])] : fallback.inventory,
      equipped: { ...fallback.equipped, ...(parsed.equipped ?? {}) },
      loginCalendar: parsed.loginCalendar?.monthKey === monthKey()
        ? { monthKey: monthKey(), claimedDays: [...new Set(parsed.loginCalendar.claimedDays ?? [])].filter((day) => Number.isInteger(day) && day >= 1 && day <= 30) }
        : fallback.loginCalendar,
      dailyQuests: parsed.dailyQuests?.dayKey === dayKey()
        ? {
            dayKey: dayKey(),
            progress: {
              games: Math.max(0, Number(parsed.dailyQuests.progress?.games ?? 0) || 0),
              wins: Math.max(0, Number(parsed.dailyQuests.progress?.wins ?? 0) || 0),
              survivals: Math.max(0, Number(parsed.dailyQuests.progress?.survivals ?? 0) || 0),
            },
            claimed: Array.isArray(parsed.dailyQuests.claimed) ? parsed.dailyQuests.claimed : [],
          }
        : fallback.dailyQuests,
      claimedLevelRewards: Array.isArray(parsed.claimedLevelRewards) ? [...new Set(parsed.claimedLevelRewards.filter(Number.isInteger))] : [],
      processedResults: Array.isArray(parsed.processedResults) ? [...new Set(parsed.processedResults.filter((key): key is string => typeof key === 'string'))].slice(-100) : [],
    };
  } catch {
    return defaultGuestProfile();
  }
}

export function saveGuestProfile(profile: PlayerProfile) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable */
  }
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function yesterdayKey(date = new Date()) {
  return dayKey(new Date(date.getTime() - 86_400_000));
}

function hashSeed(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface GuestDailyDeal {
  itemId: string;
  price: number;
  originalPrice: number;
}

export interface GuestDailyInfo {
  dayKey: string;
  deals: GuestDailyDeal[];
  gift: { claimable: boolean; streak: number; canKeepStreak: boolean; nextCoins: number; nextGems: number };
}

export function guestDailyInfo(profile: PlayerProfile, catalog: { id: string; type: string; price: number; currency: string }[]): GuestDailyInfo {
  const today = dayKey();
  const eligible = catalog.filter((item) => item.type !== 'lootBox' && item.price >= 300 && item.currency !== 'gems');
  const pool = [...eligible];
  const deals: GuestDailyDeal[] = [];
  let seed = hashSeed(`mafia-deals:${today}`);
  while (deals.length < 3 && pool.length > 0) {
    seed = (Math.imul(seed, 48271) + 11) >>> 0;
    const item = pool.splice(seed % pool.length, 1)[0];
    deals.push({ itemId: item.id, price: Math.round(item.price * 0.7), originalPrice: item.price });
  }
  const lastDay = profile.dailyGift?.lastDay ?? null;
  const nextStreak = lastDay === yesterdayKey() ? (profile.dailyGift?.streak ?? 0) + 1 : 1;
  return {
    dayKey: today,
    deals,
    gift: {
      claimable: lastDay !== today,
      streak: profile.dailyGift?.streak ?? 0,
      canKeepStreak: lastDay === yesterdayKey(),
      nextCoins: DAILY_REWARD_CONFIG.baseCoins + DAILY_REWARD_CONFIG.streakCoinsPerDay * Math.min(nextStreak - 1, DAILY_REWARD_CONFIG.streakMaxDay),
      nextGems: nextStreak % DAILY_REWARD_CONFIG.gemsEveryDays === 0 ? DAILY_REWARD_CONFIG.gemsAmount : 0,
    },
  };
}

export function claimGuestDaily(profile: PlayerProfile): PlayerProfile {
  const info = guestDailyInfo(profile, []);
  if (!info.gift.claimable) throw new Error('DAILY_CLAIMED');
  const streak = info.gift.canKeepStreak ? (profile.dailyGift?.streak ?? 0) + 1 : 1;
  return {
    ...profile,
    coins: profile.coins + info.gift.nextCoins,
    gems: profile.gems + info.gift.nextGems,
    dailyGift: { lastDay: info.dayKey, streak },
  };
}

export function claimGuestLoginReward(profile: PlayerProfile, day: number): PlayerProfile {
  const today = Math.min(30, new Date().getUTCDate());
  if (day !== today) throw new Error('LOGIN_REWARD_LOCKED');
  const rewardDay = LOGIN_REWARD_CALENDAR.find((entry) => entry.day === day);
  if (!rewardDay) throw new Error('LOGIN_REWARD_NOT_FOUND');
  const calendar = profile.loginCalendar?.monthKey === monthKey()
    ? profile.loginCalendar
    : { monthKey: monthKey(), claimedDays: [] };
  if (calendar.claimedDays.includes(day)) throw new Error('LOGIN_REWARD_CLAIMED');
  const reward = rewardDay.reward;
  return {
    ...profile,
    coins: profile.coins + (reward.type === 'coins' ? reward.amount : 0),
    gems: profile.gems + (reward.type === 'gems' ? reward.amount : 0),
    inventory: reward.type === 'item' ? [...new Set([...profile.inventory, reward.itemId])] : profile.inventory,
    loginCalendar: { ...calendar, claimedDays: [...calendar.claimedDays, day] },
  };
}

function applyGuestLevelRewards(profile: PlayerProfile): PlayerProfile {
  const level = levelProgress(profile.stats.xp).level;
  const claimed = new Set(profile.claimedLevelRewards ?? []);
  let coins = profile.coins;
  let gems = profile.gems;
  const inventory = new Set(profile.inventory);
  for (const reward of PROGRESSION_CONFIG.levelRewards) {
    if (reward.level > level || claimed.has(reward.level)) continue;
    coins += reward.coins ?? 0;
    gems += reward.gems ?? 0;
    for (const item of reward.items ?? []) inventory.add(item);
    claimed.add(reward.level);
  }
  return { ...profile, coins, gems, inventory: [...inventory], claimedLevelRewards: [...claimed].sort((a, b) => a - b) };
}

export function claimGuestQuest(profile: PlayerProfile, questId: string): PlayerProfile {
  const quest = DAILY_QUESTS.find((candidate) => candidate.id === questId);
  if (!quest) throw new Error('QUEST_NOT_FOUND');
  const today = dayKey();
  const daily = profile.dailyQuests?.dayKey === today
    ? profile.dailyQuests
    : { dayKey: today, progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] };
  if (daily.claimed.includes(quest.id)) throw new Error('QUEST_CLAIMED');
  if ((daily.progress[quest.metric] ?? 0) < quest.target) throw new Error('QUEST_INCOMPLETE');
  return applyGuestLevelRewards({
    ...profile,
    coins: profile.coins + quest.rewardCoins,
    gems: profile.gems + (quest.rewardGems ?? 0),
    stats: { ...profile.stats, xp: profile.stats.xp + quest.rewardXp },
    dailyQuests: { ...daily, claimed: [...daily.claimed, quest.id] },
  });
}

export function recordGuestResult(profile: PlayerProfile, result: { idempotencyKey?: string; winner: string; playerTeam: string; role: string; alive: boolean }): PlayerProfile {
  if (result.idempotencyKey && profile.processedResults?.includes(result.idempotencyKey)) return profile;
  const won = result.winner === result.playerTeam;
  const reward = won ? (result.alive ? 120 : 100) : result.alive ? 30 : 25;
  const xp = won
    ? (result.alive ? PROGRESSION_CONFIG.gameXp.winAlive : PROGRESSION_CONFIG.gameXp.winEliminated)
    : (result.alive ? PROGRESSION_CONFIG.gameXp.lossAlive : PROGRESSION_CONFIG.gameXp.lossEliminated);
  const stats = {
    ...profile.stats,
    games: profile.stats.games + 1,
    wins: profile.stats.wins + (won ? 1 : 0),
    losses: profile.stats.losses + (won ? 0 : 1),
    xp: profile.stats.xp + xp,
    rolePlays: { ...profile.stats.rolePlays, [result.role]: (profile.stats.rolePlays[result.role] ?? 0) + 1 },
  };
  const badges = [...profile.badges];
  if (stats.games >= 1 && !badges.includes('first-game')) badges.push('first-game');
  if (stats.wins >= 1 && !badges.includes('first-win')) badges.push('first-win');
  if (stats.wins >= 10 && !badges.includes('veteran-10')) badges.push('veteran-10');
  if (stats.games >= 50 && !badges.includes('night-owl-50')) badges.push('night-owl-50');
  let gems = won && result.alive ? 1 : 0;
  if (!profile.badges.includes('first-win') && badges.includes('first-win')) gems += 5;
  if (!profile.badges.includes('veteran-10') && badges.includes('veteran-10')) gems += 10;
  if (!profile.badges.includes('night-owl-50') && badges.includes('night-owl-50')) gems += 25;
  const today = dayKey();
  const daily = profile.dailyQuests?.dayKey === today
    ? profile.dailyQuests
    : { dayKey: today, progress: { games: 0, wins: 0, survivals: 0 }, claimed: [] };
  return applyGuestLevelRewards({
    ...profile,
    coins: profile.coins + reward,
    gems: profile.gems + gems,
    stats,
    badges,
    processedResults: result.idempotencyKey
      ? [...(profile.processedResults ?? []), result.idempotencyKey].slice(-100)
      : profile.processedResults,
    dailyQuests: {
      ...daily,
      progress: {
        games: daily.progress.games + 1,
        wins: daily.progress.wins + (won ? 1 : 0),
        survivals: daily.progress.survivals + (result.alive ? 1 : 0),
      },
    },
  });
}
