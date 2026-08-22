'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, VolumeX, X } from 'lucide-react';
import { useAudioSettings } from '@/context/AudioContext';

/**
 * إعدادات الصوت — بيتـPortal لـ document.body عشان يطلع من أي
 * header فيه backdrop-filter (اللي كان بيكسّر التمركز وبيقصّه).
 * هيكل مركز حرفي: fixed inset-0 + flex items-center justify-center.
 */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { volume, isMuted, toggleMute, setVolume } = useAudioSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const ready = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(ready);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border-2 border-gold-600/50 bg-[#120d0a]/95 p-6 text-white shadow-[0_0_50px_rgba(0,0,0,0.9)]"
          >
            {/* sleek X close */}
            <button
              onClick={onClose}
              title="اقفل"
              className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-gold-500/30 text-gold-300 transition hover:border-gold-400 hover:text-white"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <h3 className="mb-5 text-center font-serif text-xl font-black text-gold-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              إعدادات الصوت
            </h3>

            {/* Mute toggle — icon flips with state */}
            <button
              onClick={toggleMute}
              className="flex min-h-[56px] w-full items-center justify-between rounded-xl border border-gold-500/25 bg-white/[0.05] px-4 transition hover:border-gold-500/50 hover:bg-white/[0.09]"
            >
              <span className="flex items-center gap-3">
                {isMuted ? (
                  <VolumeX className="h-5 w-5 text-blood-400" strokeWidth={1.5} />
                ) : (
                  <Volume2 className="h-5 w-5 text-emerald-300" strokeWidth={1.5} />
                )}
                <span className="text-sm font-bold text-white">
                  {isMuted ? 'الصوت مقفول' : 'الصوت شغال'}
                </span>
              </span>
              <span
                className={`relative h-6.5 w-11 shrink-0 rounded-full transition-colors ${
                  isMuted ? 'bg-night-700' : 'bg-gold-500'
                }`}
              >
                <span
                  className={`absolute top-1 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${
                    isMuted ? 'right-1' : 'right-[calc(100%-1.375rem)]'
                  }`}
                />
              </span>
            </button>

            {/* Volume slider */}
            <div className={`mt-5 ${isMuted ? 'pointer-events-none opacity-40' : ''}`}>
              <div className="mb-2 flex items-center justify-between font-mono text-xs font-bold text-slate-300">
                <span>مستوى الصوت</span>
                <span className="text-gold-300">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(event) => setVolume(Number(event.target.value) / 100)}
                aria-label="مستوى الصوت"
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-night-700 accent-[#d4af37]"
                style={{
                  background: `linear-gradient(to left, #d4af37 ${(volume * 100).toFixed(0)}%, #202634 ${(volume * 100).toFixed(0)}%)`,
                }}
              />
            </div>

            <p className="mt-5 text-center text-[11px] italic text-slate-400">
              الإعدادات بتتحفظ على جهازك وتشيل معاكها لأي أوضة
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
