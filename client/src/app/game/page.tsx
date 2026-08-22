'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { GameClient } from '@/components/GameClient';

// output: 'export' — كود الأوضة بقى query param لأن المسار الديناميكي
// ([code]) متولدش مسبقًا في الـ static export
function GameRoom() {
  const code = useSearchParams().get('code') ?? '';
  if (!code) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-slate-400">اللينك ناقصه كود الأوضة.</p>
        <Link
          href="/"
          className="rounded-lg border border-gold-500/50 bg-gold-500/15 px-5 py-2.5 text-sm font-bold text-gold-300"
        >
          ارجع للصفحة الرئيسية
        </Link>
      </main>
    );
  }
  return <GameClient code={code.toUpperCase()} />;
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold-400" strokeWidth={1.5} />
        </div>
      }
    >
      <GameRoom />
    </Suspense>
  );
}
