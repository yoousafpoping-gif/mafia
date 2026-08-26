export type LoginReward =
  | { type: 'coins'; amount: number }
  | { type: 'gems'; amount: number }
  | { type: 'item'; itemId: string; label: string; category: 'cardFrame' | 'background' };

export interface LoginRewardDay {
  day: number;
  reward: LoginReward;
}

/** تقويم تسجيل الدخول المركزي. يجب إبقاء المعرفات متطابقة مع كتالوج السيرفر. */
export const LOGIN_REWARD_CALENDAR: readonly LoginRewardDay[] = [
  { day: 1, reward: { type: 'coins', amount: 100 } },
  { day: 2, reward: { type: 'coins', amount: 125 } },
  { day: 3, reward: { type: 'gems', amount: 2 } },
  { day: 4, reward: { type: 'coins', amount: 150 } },
  { day: 5, reward: { type: 'coins', amount: 175 } },
  { day: 6, reward: { type: 'gems', amount: 3 } },
  { day: 7, reward: { type: 'item', itemId: 'frame-blood', label: 'إطار الدم', category: 'cardFrame' } },
  { day: 8, reward: { type: 'coins', amount: 200 } },
  { day: 9, reward: { type: 'coins', amount: 225 } },
  { day: 10, reward: { type: 'gems', amount: 4 } },
  { day: 11, reward: { type: 'coins', amount: 250 } },
  { day: 12, reward: { type: 'coins', amount: 275 } },
  { day: 13, reward: { type: 'gems', amount: 5 } },
  { day: 14, reward: { type: 'item', itemId: 'bg-city', label: 'ليل المدينة', category: 'background' } },
  { day: 15, reward: { type: 'coins', amount: 300 } },
  { day: 16, reward: { type: 'coins', amount: 325 } },
  { day: 17, reward: { type: 'gems', amount: 6 } },
  { day: 18, reward: { type: 'coins', amount: 350 } },
  { day: 19, reward: { type: 'coins', amount: 375 } },
  { day: 20, reward: { type: 'gems', amount: 7 } },
  { day: 21, reward: { type: 'item', itemId: 'frame-neon', label: 'إطار النيون', category: 'cardFrame' } },
  { day: 22, reward: { type: 'coins', amount: 400 } },
  { day: 23, reward: { type: 'coins', amount: 425 } },
  { day: 24, reward: { type: 'gems', amount: 8 } },
  { day: 25, reward: { type: 'coins', amount: 450 } },
  { day: 26, reward: { type: 'coins', amount: 475 } },
  { day: 27, reward: { type: 'gems', amount: 10 } },
  { day: 28, reward: { type: 'item', itemId: 'bg-blood-moon', label: 'قمر الدم', category: 'background' } },
  { day: 29, reward: { type: 'coins', amount: 600 } },
  { day: 30, reward: { type: 'item', itemId: 'frame-gold', label: 'إطار الدون الذهبي', category: 'cardFrame' } },
] as const;

export function loginRewardLabel(reward: LoginReward): string {
  if (reward.type === 'coins') return `${reward.amount} كوينز`;
  if (reward.type === 'gems') return `${reward.amount} جواهر`;
  return reward.label;
}
