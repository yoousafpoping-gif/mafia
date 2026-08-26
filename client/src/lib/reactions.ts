'use client';

/**
 * نظام ريأكشنز حارة المافيا — إيموجي 3D (Fluent Emoji, MIT) + أصوات
 * مولّدة محليًا، بصوت مكاني: اللي على يمين الطاولة صوته من اليمين.
 */

import { isAudioMuted, masterVolume } from './audioManager';

export interface ReactionDef {
  id: ReactionId;
  label: string;
  /** إيموجي النص الافتراضي (fallback لو الصورة مش موجودة) */
  fallback: string;
  asset: string;
  sound: string;
  /** لو موجود — الريأكشن مدفوع في المتجر ومحتاج ملكية العنصر ده */
  storeItem?: string;
}

export type ReactionId = 'evil_laugh' | 'applause' | 'gasp' | 'shush' | 'target' | 'fire' | 'skull' | 'money' | 'clap_gold';

export const REACTIONS: ReactionDef[] = [
  {
    id: 'evil_laugh',
    label: 'شريرة 😈',
    fallback: '😈',
    asset: '/assets/emojis/evil_laugh_3d.png',
    sound: '/assets/sounds/reactions/evil_laugh.wav',
  },
  {
    id: 'applause',
    label: 'تصفيق 👏',
    fallback: '👏',
    asset: '/assets/emojis/applause_3d.png',
    sound: '/assets/sounds/reactions/applause.wav',
  },
  {
    id: 'gasp',
    label: 'شهقة 😱',
    fallback: '😱',
    asset: '/assets/emojis/gasp_3d.png',
    sound: '/assets/sounds/reactions/gasp.wav',
  },
  {
    id: 'shush',
    label: 'هسّة 🤫',
    fallback: '🤫',
    asset: '/assets/emojis/shush_3d.png',
    sound: '/assets/sounds/reactions/shush.wav',
    storeItem: 'emote-shush',
  },
  {
    id: 'target',
    label: 'اتهم 🎯',
    fallback: '🎯',
    asset: '/assets/emojis/target_3d.png',
    sound: '/assets/sounds/reactions/target.wav',
    storeItem: 'emote-target',
  },
  /* --- ريأكشنز المتجر — بتظهر في الشريط لمن يملكها --- */
  {
    id: 'fire',
    label: 'نار 🔥',
    fallback: '🔥',
    asset: '/assets/emojis/fire_3d.svg',
    sound: '/assets/sounds/reactions/evil_laugh.wav',
    storeItem: 'emote-fire',
  },
  {
    id: 'skull',
    label: 'موت 💀',
    fallback: '💀',
    asset: '/assets/emojis/skull_3d.svg',
    sound: '/assets/sounds/reactions/gasp.wav',
    storeItem: 'emote-skull',
  },
  {
    id: 'money',
    label: 'فلوس 💰',
    fallback: '💰',
    asset: '/assets/emojis/money_3d.svg',
    sound: '/assets/sounds/reactions/target.wav',
    storeItem: 'emote-money',
  },
  {
    id: 'clap_gold',
    label: 'برافو ✨',
    fallback: '✨',
    asset: '/assets/emojis/clap_gold_3d.svg',
    sound: '/assets/sounds/reactions/applause.wav',
    storeItem: 'emote-clap-gold',
  },
];

export function reactionById(id: string): ReactionDef | null {
  return REACTIONS.find((r) => r.id === id) ?? null;
}

/* --- مشغّل صوت مكاني: decode مرة واحدة + StereoPanner حسب مقعد اللاعب --- */

const bufferCache = new Map<string, AudioBuffer | null>();
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (bufferCache.has(url)) return bufferCache.get(url) ?? null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const ctx = getCtx();
    if (!ctx) throw new Error('no ctx');
    const raw = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(raw);
    bufferCache.set(url, buffer);
    return buffer;
  } catch {
    bufferCache.set(url, null);
    return null;
  }
}

/**
 * شغّل صوت الريأكشن — pan من -1 (شمال) لـ +1 (يمين) حسب مقعد اللاعب.
 * الصوت بيمشي على إعدادات الكتم والفولوم العامة للعبة.
 */
export async function playReactionSound(id: string, pan: number): Promise<void> {
  if (typeof window === 'undefined' || isAudioMuted()) return;
  const def = reactionById(id);
  if (!def) return;
  const ctx = getCtx();
  if (!ctx) return;

  const buffer = await loadBuffer(def.sound);
  if (!buffer) return; // ملف ناقص — سكوت أشوش من صوت مزعج

  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    const gain = ctx.createGain();
    gain.gain.value = masterVolume();
    source.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    /* context مقفول — مش مشكلة */
  }
}
