'use client';

/**
 * مرجع عرض الكوزمتكس على الكلاينت — مرآة عرضية للكتالوج الرسمي
 * (src/profiles/catalog.js على السيرفر هو مصدر الأسعار والملكية).
 * المطلوب هنا: أسماء العرض، ألوان الـ rarity، مسارات الصور، وأدوات البحث.
 */

export type CosmeticType = 'cardFrame' | 'title' | 'emote' | 'background' | 'lootBox';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CosmeticItem {
  id: string;
  type: CosmeticType;
  name: string;
  price: number;
  currency: 'coins' | 'gems';
  rarity: Rarity;
  image?: string;
  cssClass?: string;
  odds?: Record<Rarity, number>;
}

export const COSMETICS: CosmeticItem[] = [
  { id: 'frame-classic', type: 'cardFrame', name: 'الإطار الكلاسيكي', price: 0, currency: 'coins', rarity: 'common', image: '/assets/frames/frame-classic.svg', cssClass: 'ring-slate-500' },
  { id: 'frame-blood', type: 'cardFrame', name: 'إطار الدم', price: 350, currency: 'coins', rarity: 'rare', image: '/assets/frames/frame-blood.svg', cssClass: 'ring-red-600 shadow-red-900/60' },
  { id: 'frame-gold', type: 'cardFrame', name: 'إطار الدون الذهبي', price: 900, currency: 'coins', rarity: 'epic', image: '/assets/frames/frame-gold.svg', cssClass: 'ring-amber-400 shadow-amber-500/50' },
  { id: 'frame-neon', type: 'cardFrame', name: 'إطار النيون', price: 650, currency: 'coins', rarity: 'rare', image: '/assets/frames/frame-neon.svg', cssClass: 'ring-fuchsia-500 shadow-fuchsia-500/50' },
  { id: 'frame-ice', type: 'cardFrame', name: 'إطار الجليد', price: 500, currency: 'coins', rarity: 'rare', image: '/assets/frames/frame-ice.svg', cssClass: 'ring-cyan-300 shadow-cyan-500/50' },
  { id: 'frame-emerald', type: 'cardFrame', name: 'إطار الزمرد', price: 750, currency: 'coins', rarity: 'epic', image: '/assets/frames/frame-emerald.svg', cssClass: 'ring-emerald-400 shadow-emerald-500/50' },
  { id: 'frame-noir', type: 'cardFrame', name: 'إطار نوار', price: 450, currency: 'coins', rarity: 'rare', image: '/assets/frames/frame-noir.svg', cssClass: 'ring-zinc-300 shadow-black' },
  { id: 'frame-royal', type: 'cardFrame', name: 'الإطار الملكي', price: 1400, currency: 'coins', rarity: 'legendary', image: '/assets/frames/frame-royal.svg', cssClass: 'ring-violet-400 shadow-violet-500/60' },
  { id: 'frame-venom', type: 'cardFrame', name: 'إطار السم', price: 850, currency: 'coins', rarity: 'epic', image: '/assets/frames/frame-venom.svg', cssClass: 'ring-lime-500 shadow-lime-500/50' },
  { id: 'frame-inferno', type: 'cardFrame', name: 'إطار الجحيم', price: 1200, currency: 'coins', rarity: 'legendary', image: '/assets/frames/frame-inferno.svg', cssClass: 'ring-orange-500 shadow-orange-600/60' },
  { id: 'frame-pharaoh', type: 'cardFrame', name: 'إطار الفرعون', price: 20, currency: 'gems', rarity: 'legendary', image: '/assets/frames/frame-pharaoh.svg', cssClass: 'ring-yellow-500 shadow-teal-500/60' },
  { id: 'frame-void', type: 'cardFrame', name: 'إطار العدم', price: 30, currency: 'gems', rarity: 'legendary', image: '/assets/frames/frame-void.svg', cssClass: 'ring-indigo-500 shadow-indigo-500/60' },

  { id: 'title-detective', type: 'title', name: 'المحقق الصامت', price: 400, currency: 'coins', rarity: 'rare' },
  { id: 'title-don', type: 'title', name: 'الدون', price: 1000, currency: 'coins', rarity: 'epic' },
  { id: 'title-ghost', type: 'title', name: 'شبح القاهرة', price: 600, currency: 'coins', rarity: 'rare' },
  { id: 'title-godfather', type: 'title', name: 'عرّاب الليل', price: 750, currency: 'coins', rarity: 'epic' },
  { id: 'title-king', type: 'title', name: 'ملك الليل', price: 25, currency: 'gems', rarity: 'legendary' },

  { id: 'emote-shush', type: 'emote', name: 'هسّة', price: 300, currency: 'coins', rarity: 'rare', image: '/assets/emojis/shush_3d.png' },
  { id: 'emote-target', type: 'emote', name: 'اتهم', price: 350, currency: 'coins', rarity: 'rare', image: '/assets/emojis/target_3d.png' },
  { id: 'emote-fire', type: 'emote', name: 'نار', price: 450, currency: 'coins', rarity: 'epic', image: '/assets/emojis/fire_3d.svg' },
  { id: 'emote-skull', type: 'emote', name: 'الجمجمة', price: 550, currency: 'coins', rarity: 'epic', image: '/assets/emojis/skull_3d.svg' },
  { id: 'emote-money', type: 'emote', name: 'كيس الفلوس', price: 400, currency: 'coins', rarity: 'rare', image: '/assets/emojis/money_3d.svg' },
  { id: 'emote-clap-gold', type: 'emote', name: 'تصفيق ذهبي', price: 18, currency: 'gems', rarity: 'legendary', image: '/assets/emojis/clap_gold_3d.svg' },

  { id: 'bg-city', type: 'background', name: 'ليل المدينة', price: 500, currency: 'coins', rarity: 'rare', image: '/assets/backgrounds/bg-city.svg' },
  { id: 'bg-blood-moon', type: 'background', name: 'قمر الدم', price: 700, currency: 'coins', rarity: 'epic', image: '/assets/backgrounds/bg-blood-moon.svg' },
  { id: 'bg-casino', type: 'background', name: 'الكازينو', price: 800, currency: 'coins', rarity: 'epic', image: '/assets/backgrounds/bg-casino.svg' },
  { id: 'bg-royal', type: 'background', name: 'القاعة الملكية', price: 10, currency: 'gems', rarity: 'legendary', image: '/assets/backgrounds/bg-royal.svg' },

  { id: 'box-basic', type: 'lootBox', name: 'صندوق خشبي', price: 400, currency: 'coins', rarity: 'rare', image: '/assets/boxes/box-basic.svg', odds: { common: 55, rare: 30, epic: 12, legendary: 3 } },
  { id: 'box-golden', type: 'lootBox', name: 'صندوق ذهبي', price: 5, currency: 'gems', rarity: 'epic', image: '/assets/boxes/box-golden.svg', odds: { common: 0, rare: 45, epic: 38, legendary: 17 } },
  { id: 'box-legendary', type: 'lootBox', name: 'صندوق أسطوري', price: 15, currency: 'gems', rarity: 'legendary', image: '/assets/boxes/box-legendary.svg', odds: { common: 0, rare: 30, epic: 45, legendary: 25 } },
];

const BY_ID = new Map(COSMETICS.map((item) => [item.id, item]));

export function cosmeticById(id: string | null | undefined): CosmeticItem | null {
  return id ? BY_ID.get(id) ?? null : null;
}

/** صورة الإطار — fallback لإطار كلاسيك لو الـ id مجهول */
export function frameImage(frameId: string | null | undefined): string {
  return cosmeticById(frameId)?.image ?? '/assets/frames/frame-classic.svg';
}

/** اسم اللقب للعرض جانب الأسماء */
export function titleName(titleId: string | null | undefined): string | null {
  const item = cosmeticById(titleId);
  return item?.type === 'title' ? item.name : null;
}

/** خلفية الترابيزة المجهزة — null = الافتراضية */
export function backgroundImage(bgId: string | null | undefined): string | null {
  const item = cosmeticById(bgId);
  return item?.type === 'background' ? item.image ?? null : null;
}

/* ---------- rarity: ألوان الشارات والتسمية العربية ---------- */

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'عادي',
  rare: 'نادر',
  epic: 'ملحمي',
  legendary: 'أسطوري',
};

export const RARITY_BADGE: Record<Rarity, string> = {
  common: 'border-slate-400/40 bg-slate-400/10 text-slate-300',
  rare: 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300',
  epic: 'border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300',
  legendary: 'border-amber-400/60 bg-amber-400/15 text-amber-300 shadow-[0_0_14px_rgba(244,217,123,0.25)]',
};

export const RARITY_RING: Record<Rarity, string> = {
  common: 'hover:border-slate-400/40',
  rare: 'hover:border-cyan-400/50',
  epic: 'hover:border-fuchsia-400/50',
  legendary: 'hover:border-amber-400/60',
};
