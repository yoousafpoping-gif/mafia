'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import type { ToastItem } from '@/hooks/useMafiaGame';

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => onDismiss(toast.id)}
            className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg border border-blood-500/50 bg-night-800/95 px-4 py-2.5 text-left text-sm text-slate-200 shadow-xl backdrop-blur"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blood-400" />
            <span>
              <span className="mr-2 font-mono text-[11px] text-blood-400">
                {toast.code ?? 'ERROR'}
              </span>
              {toast.message}
            </span>
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
