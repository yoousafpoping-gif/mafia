'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSavedMuted, getSavedVolume, saveAudioSettings } from '@/lib/audioManager';

interface AudioSettings {
  /** 0 → 1 master multiplier applied to every sound in the game. */
  volume: number;
  isMuted: boolean;
  toggleMute: () => void;
  setVolume: (value: number) => void;
}

const AudioSettingsContext = createContext<AudioSettings | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Hydrate once on mount (localStorage is browser-only; deferred so the
  // setState call never runs synchronously inside the effect body).
  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      setVolumeState(getSavedVolume());
      setIsMuted(getSavedMuted());
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveAudioSettings(null, next);
      return next;
    });
  }, []);

  const setVolume = useCallback((value: number) => {
    const next = Math.min(1, Math.max(0, value));
    setVolumeState(next);
    saveAudioSettings(next, null);
    // Unmuting implicitly when the user drags the slider back up.
    if (next > 0) {
      setIsMuted((prev) => {
        if (!prev) return prev;
        saveAudioSettings(null, false);
        return false;
      });
    }
  }, []);

  const value = useMemo(
    () => ({ volume, isMuted, toggleMute, setVolume }),
    [volume, isMuted, toggleMute, setVolume],
  );

  return <AudioSettingsContext.Provider value={value}>{children}</AudioSettingsContext.Provider>;
}

export function useAudioSettings(): AudioSettings {
  const ctx = useContext(AudioSettingsContext);
  if (!ctx) throw new Error('useAudioSettings must be used inside <AudioProvider>');
  return ctx;
}
