'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { initGlobalSfx } from '@/lib/sfx';
import { useMafiaGame } from '@/hooks/useMafiaGame';
import { LandingScreen } from '@/components/LandingScreen';
import type { RoomSettingsState } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { createRoom, joinRoom, quickMatch, status, toasts, dismissToast } = useMafiaGame();
  const { profile } = useAuth();
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initGlobalSfx();
  }, []);

  const playerName = profile?.playerName ?? '';
  const canAct = playerName.length >= 2 && !busy;

  const handleCreate = async () => {
    if (!canAct) return;
    setBusy(true);
    try {
      const code = await createRoom(playerName);
      router.push(`/game?code=${code}`);
    } catch {
      setBusy(false);
    }
  };

  const handleCustomCreate = async (settings: RoomSettingsState) => {
    if (!canAct) return;
    setBusy(true);
    try {
      const code = await createRoom(playerName, settings, true);
      router.push(`/game?code=${code}`);
    } catch {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!canAct || codeInput.trim().length < 4) return;
    setBusy(true);
    try {
      const code = await joinRoom(codeInput, playerName);
      router.push(`/game?code=${code}`);
    } catch {
      setBusy(false);
    }
  };

  const handlePractice = async () => {
    if (!canAct) return;
    setBusy(true);
    try {
      sessionStorage.setItem('mafia-practice', '5');
      const code = await createRoom(playerName);
      router.push(`/game?code=${code}`);
    } catch {
      setBusy(false);
    }
  };

  // البحث السريع — انضم لأي أوضة عامة مفتوحة، أو اعمل واحدة واستنى
  const handleQuickMatch = async () => {
    if (!canAct) return;
    setBusy(true);
    try {
      const code = await quickMatch(playerName);
      router.push(`/game?code=${code}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      <LandingScreen
        codeInput={codeInput}
        onCodeChange={setCodeInput}
        busy={busy}
        connected={status.connected}
        onCreate={handleCreate}
        onCreateCustom={handleCustomCreate}
        onJoin={handleJoin}
        onPractice={handlePractice}
        onQuickMatch={handleQuickMatch}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: number; code?: string; message: string }[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <motion.button
          key={toast.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          onClick={() => onDismiss(toast.id)}
          className="pointer-events-auto max-w-md rounded-lg border border-blood-500/50 bg-night-800/95 px-4 py-2.5 text-sm text-slate-200 shadow-xl backdrop-blur"
        >
          <span className="mr-2 font-mono text-xs text-blood-400">{toast.code ?? 'ERROR'}</span>
          {toast.message}
        </motion.button>
      ))}
    </div>
  );
}
