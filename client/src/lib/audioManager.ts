'use client';

/**
 * Global audio settings store — single source of truth for EVERY sound
 * in the game (synth SFX, ambience loops, mp3 one-shots).
 *
 * Persisted keys:
 *   gameVolume  : '0'..'1'   (master volume multiplier)
 *   gameMuted   : 'true'|'false'
 *   mafia-muted : '1'|'0'    (legacy key kept in sync for old readers)
 */

export const VOLUME_KEY = 'gameVolume';
export const MUTED_KEY = 'gameMuted';
const LEGACY_MUTED_KEY = 'mafia-muted';

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function getSavedVolume(): number {
  if (typeof window === 'undefined') return 1;
  try {
    return clamp01(parseFloat(window.localStorage.getItem(VOLUME_KEY) ?? '1'));
  } catch {
    return 1;
  }
}

export function getSavedMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = window.localStorage.getItem(MUTED_KEY);
    if (current !== null) return current === 'true';
    return window.localStorage.getItem(LEGACY_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveAudioSettings(volume: number | null, muted: boolean | null) {
  if (typeof window === 'undefined') return;
  try {
    if (volume !== null) window.localStorage.setItem(VOLUME_KEY, String(clamp01(volume)));
    if (muted !== null) {
      window.localStorage.setItem(MUTED_KEY, String(muted));
      window.localStorage.setItem(LEGACY_MUTED_KEY, muted ? '1' : '0');
    }
  } catch {
    /* storage unavailable */
  }
}

/* Live readers used by the audio engines on every playback. */
export const isAudioMuted = () => getSavedMuted();
export const masterVolume = () => (getSavedMuted() ? 0 : getSavedVolume());

/**
 * One-shot mp3 player that respects the global mute + volume.
 * Returns the element so callers may stop it later (ambience etc.).
 */
export const playSound = (audioFile: string, volume = 1): HTMLAudioElement | null => {
  if (typeof window === 'undefined') return null;
  if (isAudioMuted()) return null;

  const audio = new Audio(audioFile);
  audio.volume = clamp01(getSavedVolume() * volume);
  void audio.play().catch(() => {});
  return audio;
};

/* --- Narrator voice lines: one at a time, never overlapping --- */

let narratorAudio: HTMLAudioElement | null = null;

/** Hard-stops whatever narrator line is currently playing (if any). */
export function stopNarrator() {
  if (!narratorAudio) return;
  const audio = narratorAudio;
  narratorAudio = null;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* already dead */
  }
}

/**
 * Narrator playback with an overlap guard: any previous line is stopped
 * BEFORE the new one starts, so rapid phase transitions can never stack
 * two voice lines on top of each other.
 */
export function playNarrator(audioFile: string, volume = 1) {
  stopNarrator();
  narratorAudio = playSound(audioFile, volume);
}
