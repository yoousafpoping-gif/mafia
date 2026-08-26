/* ============================================================
   NOIR DESIGN SYSTEM — "Mafia Undercover"
   Single source of truth for the crimson & gold noir language
   shared by the landing screen and every internal view.
   CSS companions live in src/app/globals.css.
   ============================================================ */

/** Canonical AAA noir palette — keep Tailwind theme tokens in sync. */
export const PALETTE = {
  obsidian: '#0b0d10',
  crimson: '#e63946',
  agedGold: '#d4af37',
} as const;

/** Glassmorphic surface — identical to the main-menu card. */
export const GLASS_PANEL = 'glass-panel';

/** Beveled gold gradient frame (amber-600 → yellow-500 → amber-700). */
export const GOLD_FRAME = 'gold-frame';

/** Dark rainy-alley room: radial lamp glow + cobblestone + vignette. */
export const NOIR_VIGNETTE = 'noir-vignette';

/** Heavy metallic-gold display header with hard noir drop shadow. */
export const METAL_HEADER =
  'text-metallic-gold font-serif font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]';

/**
 * Premium metallic-gold treatment for ALL chrome icons (settings, mute,
 * leave, mic...). Pair with strokeWidth={1.5} for thin elegant lines.
 */
export const GOLD_ICON =
  'text-[#d4af37] hover:text-white transition-colors drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]';

/** Glowing crimson neon edge for active / danger states. */
export const CRIMSON_EDGE = 'crimson-edge';

/** Unified button hover physics shared by ALL screens. */
export const BTN_HOVER =
  'transition-all duration-200 transform-gpu enabled:hover:scale-[1.05] enabled:active:scale-[0.97]';

/**
 * Shared button recipes.
 * Every interactive control must use one of these so hover feel,
 * glow and SFX behaviour stay identical across the game.
 */
export const btn = {
  /** Primary crimson→gold action pill (create room, confirm votes). */
  primary:
    'btn-noir gold-hover-glow bg-gradient-to-l from-blood-800 via-blood-700 to-blood-600 text-white border border-gold-400/70 shadow-[0_0_24px_rgba(185,28,28,0.4)]',
  /** Gold-tinted secondary (join, send, small actions). */
  gold: 'btn-noir gold-hover-glow border border-gold-500/50 bg-gold-500/12 text-gold-300 enabled:hover:border-gold-400/80 enabled:hover:bg-gold-500/22',
  /** Neutral ghost on glass surfaces. */
  ghost:
    'btn-noir gold-hover-glow border border-white/10 bg-white/[0.06] text-slate-200 backdrop-blur enabled:hover:border-gold-500/50 enabled:hover:bg-white/[0.11]',
  /** Round icon chip used in TopBar and drawer headers. */
  icon: 'btn-noir gold-hover-glow flex h-9 w-9 items-center justify-center rounded-full border border-night-600 bg-night-900/80 text-slate-300 enabled:hover:border-gold-500/60 enabled:hover:text-gold-300',
  /** Danger (leave, kick). */
  danger:
    'btn-noir gold-hover-glow border border-night-600 bg-white/[0.05] text-slate-400 enabled:hover:border-blood-500/70 enabled:hover:bg-blood-700/25 enabled:hover:text-blood-200',
} as const;

/** Small mono uppercase micro-label (English AAA flavor). */
export const MICRO_LABEL =
  'font-mono text-[9px] font-bold tracking-[0.3em] text-slate-500 uppercase';

/** Standard inset card padding radius combo for drawers/modals content. */
export const DRAWER_SHELL =
  'pointer-events-auto relative flex h-full w-full max-w-sm flex-col overflow-hidden rounded-s-3xl shadow-[-30px_0_80px_rgba(0,0,0,0.7)]';
