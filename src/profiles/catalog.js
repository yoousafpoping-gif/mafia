/* ===== كتالوج الكوزمتكس — المصدر الوحيد للحقيقة (server-authoritative) =====
 * image: مسار الأصل داخل client/public — SVG من تصميمنا أو PNG/WebP من أدوات AI
 *        (إطار: 512×768 شفاف الوسط بنسبة 2:3 — خلفية: 1920×1080)
 * currency: 'coins' (افتراضي) أو 'gems'
 * rarity: common | rare | epic | legendary — مستخدمة في أوزان صناديق الحظ
 */

export const COSMETIC_CATALOG = Object.freeze([
  /* ---------- إطارات الكروت ---------- */
  { id: 'frame-classic', type: 'cardFrame', name: 'الإطار الكلاسيكي', price: 0, rarity: 'common', cssClass: 'ring-slate-500', image: '/assets/frames/frame-classic.svg' },
  { id: 'frame-blood', type: 'cardFrame', name: 'إطار الدم', price: 350, rarity: 'rare', cssClass: 'ring-red-600 shadow-red-900/60', image: '/assets/frames/frame-blood.svg' },
  { id: 'frame-gold', type: 'cardFrame', name: 'إطار الدون الذهبي', price: 900, rarity: 'epic', cssClass: 'ring-amber-400 shadow-amber-500/50', image: '/assets/frames/frame-gold.svg' },
  { id: 'frame-neon', type: 'cardFrame', name: 'إطار النيون', price: 650, rarity: 'rare', cssClass: 'ring-fuchsia-500 shadow-fuchsia-500/50', image: '/assets/frames/frame-neon.svg' },
  { id: 'frame-ice', type: 'cardFrame', name: 'إطار الجليد', price: 500, rarity: 'rare', cssClass: 'ring-cyan-300 shadow-cyan-500/50', image: '/assets/frames/frame-ice.svg' },
  { id: 'frame-emerald', type: 'cardFrame', name: 'إطار الزمرد', price: 750, rarity: 'epic', cssClass: 'ring-emerald-400 shadow-emerald-500/50', image: '/assets/frames/frame-emerald.svg' },
  { id: 'frame-noir', type: 'cardFrame', name: 'إطار نوار', price: 450, rarity: 'rare', cssClass: 'ring-zinc-300 shadow-black', image: '/assets/frames/frame-noir.svg' },
  { id: 'frame-royal', type: 'cardFrame', name: 'الإطار الملكي', price: 1400, rarity: 'legendary', cssClass: 'ring-violet-400 shadow-violet-500/60', image: '/assets/frames/frame-royal.svg' },
  { id: 'frame-venom', type: 'cardFrame', name: 'إطار السم', price: 850, rarity: 'epic', cssClass: 'ring-lime-500 shadow-lime-500/50', image: '/assets/frames/frame-venom.svg' },
  { id: 'frame-inferno', type: 'cardFrame', name: 'إطار الجحيم', price: 1200, rarity: 'legendary', cssClass: 'ring-orange-500 shadow-orange-600/60', image: '/assets/frames/frame-inferno.svg' },
  { id: 'frame-pharaoh', type: 'cardFrame', name: 'إطار الفرعون', price: 20, currency: 'gems', rarity: 'legendary', cssClass: 'ring-yellow-500 shadow-teal-500/60', image: '/assets/frames/frame-pharaoh.svg' },
  { id: 'frame-void', type: 'cardFrame', name: 'إطار العدم', price: 30, currency: 'gems', rarity: 'legendary', cssClass: 'ring-indigo-500 shadow-indigo-500/60', image: '/assets/frames/frame-void.svg' },

  /* ---------- الألقاب ---------- */
  { id: 'title-detective', type: 'title', name: 'المحقق الصامت', price: 400, rarity: 'rare' },
  { id: 'title-don', type: 'title', name: 'الدون', price: 1000, rarity: 'epic' },
  { id: 'title-ghost', type: 'title', name: 'شبح القاهرة', price: 600, rarity: 'rare' },
  { id: 'title-godfather', type: 'title', name: 'عرّاب الليل', price: 750, rarity: 'epic' },
  { id: 'title-king', type: 'title', name: 'ملك الليل', price: 25, currency: 'gems', rarity: 'legendary' },

  /* ---------- إيموجي التفاعلات ----------
   * evil_laugh وapplause وgasp مجانية؛ الباقي يحتاج ملكية عنصر المتجر المقابل.
   */
  { id: 'emote-shush', type: 'emote', name: 'هسّة', price: 300, rarity: 'rare', image: '/assets/emojis/shush_3d.png' },
  { id: 'emote-target', type: 'emote', name: 'اتهم', price: 350, rarity: 'rare', image: '/assets/emojis/target_3d.png' },
  { id: 'emote-fire', type: 'emote', name: 'نار', price: 450, rarity: 'epic', image: '/assets/emojis/fire_3d.svg' },
  { id: 'emote-skull', type: 'emote', name: 'الجمجمة', price: 550, rarity: 'epic', image: '/assets/emojis/skull_3d.svg' },
  { id: 'emote-money', type: 'emote', name: 'كيس الفلوس', price: 400, rarity: 'rare', image: '/assets/emojis/money_3d.svg' },
  { id: 'emote-clap-gold', type: 'emote', name: 'تصفيق ذهبي', price: 18, currency: 'gems', rarity: 'legendary', image: '/assets/emojis/clap_gold_3d.svg' },

  /* ---------- خلفيات الترابيزة (عرض شخصي) ---------- */
  { id: 'bg-city', type: 'background', name: 'ليل المدينة', price: 500, rarity: 'rare', image: '/assets/backgrounds/bg-city.svg' },
  { id: 'bg-blood-moon', type: 'background', name: 'قمر الدم', price: 700, rarity: 'epic', image: '/assets/backgrounds/bg-blood-moon.svg' },
  { id: 'bg-casino', type: 'background', name: 'الكازينو', price: 800, rarity: 'epic', image: '/assets/backgrounds/bg-casino.svg' },
  { id: 'bg-royal', type: 'background', name: 'القاعة الملكية', price: 10, currency: 'gems', rarity: 'legendary', image: '/assets/backgrounds/bg-royal.svg' },

  /* ---------- صناديق الحظ ---------- */
  { id: 'box-basic', type: 'lootBox', name: 'صندوق خشبي', price: 400, rarity: 'rare', image: '/assets/boxes/box-basic.svg', odds: { common: 55, rare: 30, epic: 12, legendary: 3 } },
  { id: 'box-golden', type: 'lootBox', name: 'صندوق ذهبي', price: 5, currency: 'gems', rarity: 'epic', image: '/assets/boxes/box-golden.svg', odds: { common: 0, rare: 45, epic: 38, legendary: 17 } },
  { id: 'box-legendary', type: 'lootBox', name: 'صندوق أسطوري', price: 15, currency: 'gems', rarity: 'legendary', image: '/assets/boxes/box-legendary.svg', odds: { common: 0, rare: 30, epic: 45, legendary: 25 } },
]);

export const CATALOG_BY_ID = new Map(COSMETIC_CATALOG.map((item) => [item.id, item]));

/* ===== العروض اليومية — 3 عناصر بخصم 30٪ بتدوير حتمي من مفتاح اليوم ===== */

const DEAL_DISCOUNT = 0.3;
const DEAL_PRICE_MIN = 300;

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function currentDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** عناصر الصفقات: أغلى من الحد الأدنى، مش صناديق (عشان متتخصمش) */
export function dailyDeals(dayKey = currentDayKey(), count = 3) {
  const eligible = COSMETIC_CATALOG.filter((item) => item.type !== 'lootBox' && item.price >= DEAL_PRICE_MIN && item.currency !== 'gems');
  const picks = [];
  let seed = hashSeed(`mafia-deals:${dayKey}`);
  const pool = [...eligible];
  while (picks.length < count && pool.length > 0) {
    seed = (Math.imul(seed, 48271) + 11) >>> 0;
    picks.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return picks.map((item) => ({ itemId: item.id, price: Math.round(item.price * (1 - DEAL_DISCOUNT)), originalPrice: item.price }));
}

export function dealPriceFor(itemId, dayKey = currentDayKey()) {
  const deal = dailyDeals(dayKey).find((entry) => entry.itemId === itemId);
  return deal ? deal.price : null;
}

/* ===== تحويل العملة: فئة ثابتة واحدة ===== */
export const CONVERT_RATE = Object.freeze({ coins: 500, gems: 5 });

/* ===== مكافآت الجواهر من اللعب ===== */
export const GEM_REWARDS = Object.freeze({ winAlive: 1, badgeFirstWin: 5, badgeVeteran: 10, badgeNightOwl: 25 });

/* ===== الهدية اليومية ===== */
export const DAILY_GIFT = Object.freeze({ baseCoins: 100, streakCoinsPerDay: 25, streakMaxDay: 6, gemsEveryDays: 7, gemsAmount: 5 });

/* ===== المهام اليومية — نفس المعرفات والأهداف المعروضة في العميل ===== */
export const DAILY_QUESTS = Object.freeze([
  { id: 'play-1', title: 'انزل الحارة', metric: 'games', target: 1, rewardXp: 50, rewardCoins: 75 },
  { id: 'play-3', title: 'سهران للصبح', metric: 'games', target: 3, rewardXp: 100, rewardCoins: 150 },
  { id: 'win-1', title: 'سيّد الجولة', metric: 'wins', target: 1, rewardXp: 125, rewardCoins: 125, rewardGems: 1 },
  { id: 'survive-1', title: 'خرجت منها سليم', metric: 'survivals', target: 1, rewardXp: 75, rewardCoins: 100 },
]);

export const PROGRESSION = Object.freeze({
  maxLevel: 100,
  xpForLevel: (level) => 250 + Math.max(0, level - 1) * 100,
  gameXp: Object.freeze({ winAlive: 120, winEliminated: 80, lossAlive: 25, lossEliminated: 15 }),
  levelRewards: Object.freeze([
    { level: 2, coins: 150 },
    { level: 3, gems: 3 },
    { level: 5, coins: 400, items: ['frame-blood'] },
    { level: 10, gems: 10, items: ['title-detective'] },
    { level: 15, coins: 1000, items: ['bg-city'] },
    { level: 20, gems: 20, items: ['frame-gold'] },
    { level: 30, coins: 2500, gems: 30, items: ['bg-blood-moon'] },
  ]),
});

export function levelForXp(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  let spent = 0;
  while (level < PROGRESSION.maxLevel && xp >= spent + PROGRESSION.xpForLevel(level)) {
    spent += PROGRESSION.xpForLevel(level);
    level += 1;
  }
  return level;
}

export const DAILY_QUEST_BY_ID = new Map(DAILY_QUESTS.map((quest) => [quest.id, quest]));

/* ===== تقويم مكافآت تسجيل الدخول — مطابق حرفيًا لكتالوج العميل ===== */
export const LOGIN_REWARD_CALENDAR = Object.freeze([
  { day: 1, reward: { type: 'coins', amount: 100 } },
  { day: 2, reward: { type: 'coins', amount: 125 } },
  { day: 3, reward: { type: 'gems', amount: 2 } },
  { day: 4, reward: { type: 'coins', amount: 150 } },
  { day: 5, reward: { type: 'coins', amount: 175 } },
  { day: 6, reward: { type: 'gems', amount: 3 } },
  { day: 7, reward: { type: 'item', itemId: 'frame-blood', category: 'cardFrame' } },
  { day: 8, reward: { type: 'coins', amount: 200 } },
  { day: 9, reward: { type: 'coins', amount: 225 } },
  { day: 10, reward: { type: 'gems', amount: 4 } },
  { day: 11, reward: { type: 'coins', amount: 250 } },
  { day: 12, reward: { type: 'coins', amount: 275 } },
  { day: 13, reward: { type: 'gems', amount: 5 } },
  { day: 14, reward: { type: 'item', itemId: 'bg-city', category: 'background' } },
  { day: 15, reward: { type: 'coins', amount: 300 } },
  { day: 16, reward: { type: 'coins', amount: 325 } },
  { day: 17, reward: { type: 'gems', amount: 6 } },
  { day: 18, reward: { type: 'coins', amount: 350 } },
  { day: 19, reward: { type: 'coins', amount: 375 } },
  { day: 20, reward: { type: 'gems', amount: 7 } },
  { day: 21, reward: { type: 'item', itemId: 'frame-neon', category: 'cardFrame' } },
  { day: 22, reward: { type: 'coins', amount: 400 } },
  { day: 23, reward: { type: 'coins', amount: 425 } },
  { day: 24, reward: { type: 'gems', amount: 8 } },
  { day: 25, reward: { type: 'coins', amount: 450 } },
  { day: 26, reward: { type: 'coins', amount: 475 } },
  { day: 27, reward: { type: 'gems', amount: 10 } },
  { day: 28, reward: { type: 'item', itemId: 'bg-blood-moon', category: 'background' } },
  { day: 29, reward: { type: 'coins', amount: 600 } },
  { day: 30, reward: { type: 'item', itemId: 'frame-gold', category: 'cardFrame' } },
]);
export const LOGIN_REWARD_BY_DAY = new Map(LOGIN_REWARD_CALENDAR.map((entry) => [entry.day, entry.reward]));
