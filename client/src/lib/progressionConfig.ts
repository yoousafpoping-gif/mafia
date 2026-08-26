export type DailyQuestMetric = 'games' | 'wins' | 'survivals';

export interface DailyQuestDefinition {
  id: string;
  title: string;
  description: string;
  metric: DailyQuestMetric;
  target: number;
  rewardXp: number;
  rewardCoins: number;
  rewardGems?: number;
}

export interface LevelReward {
  level: number;
  coins?: number;
  gems?: number;
  items?: readonly string[];
}

/** المصدر المركزي لمنحنى التقدم ومكافآت اللعب والمستويات. */
export const PROGRESSION_CONFIG = {
  maxLevel: 100,
  xpForLevel: (level: number) => 250 + Math.max(0, level - 1) * 100,
  gameXp: {
    winAlive: 120,
    winEliminated: 80,
    lossAlive: 25,
    lossEliminated: 15,
  },
  levelRewards: [
    { level: 2, coins: 150 },
    { level: 3, gems: 3 },
    { level: 5, coins: 400, items: ['frame-blood'] },
    { level: 10, gems: 10, items: ['title-detective'] },
    { level: 15, coins: 1000, items: ['bg-city'] },
    { level: 20, gems: 20, items: ['frame-gold'] },
    { level: 30, coins: 2500, gems: 30, items: ['bg-blood-moon'] },
  ] as readonly LevelReward[],
} as const;

export function levelProgress(totalXp: number) {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  let levelStartXp = 0;
  while (level < PROGRESSION_CONFIG.maxLevel) {
    const required = PROGRESSION_CONFIG.xpForLevel(level);
    if (xp < levelStartXp + required) break;
    levelStartXp += required;
    level += 1;
  }
  const xpForNextLevel = level >= PROGRESSION_CONFIG.maxLevel ? 0 : PROGRESSION_CONFIG.xpForLevel(level);
  const xpIntoLevel = level >= PROGRESSION_CONFIG.maxLevel ? 0 : xp - levelStartXp;
  return {
    level,
    levelStartXp,
    xpIntoLevel,
    xpForNextLevel,
    percent: xpForNextLevel ? Math.min(100, xpIntoLevel / xpForNextLevel * 100) : 100,
  };
}

export const DAILY_QUESTS: readonly DailyQuestDefinition[] = [
  { id: 'play-1', title: 'انزل الحارة', description: 'العب مباراة واحدة اليوم', metric: 'games', target: 1, rewardXp: 50, rewardCoins: 75 },
  { id: 'play-3', title: 'سهران للصبح', description: 'العب 3 مباريات اليوم', metric: 'games', target: 3, rewardXp: 100, rewardCoins: 150 },
  { id: 'win-1', title: 'سيّد الجولة', description: 'اكسب مباراة واحدة اليوم', metric: 'wins', target: 1, rewardXp: 125, rewardCoins: 125, rewardGems: 1 },
  { id: 'survive-1', title: 'خرجت منها سليم', description: 'أنهِ مباراة وأنت حي', metric: 'survivals', target: 1, rewardXp: 75, rewardCoins: 100 },
] as const;

export const DAILY_REWARD_CONFIG = {
  baseCoins: 100,
  streakCoinsPerDay: 25,
  streakMaxDay: 6,
  gemsEveryDays: 7,
  gemsAmount: 5,
} as const;
