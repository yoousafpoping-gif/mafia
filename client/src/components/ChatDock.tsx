'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MessageSquare, Send, VenetianMask } from 'lucide-react';
import { GOLD_ICON, btn } from '@/styles/themeConfig';
import { REACTIONS } from '@/lib/reactions';
import type { ChatMessage } from '@/lib/types';

export function ChatDock({
  messages,
  youId,
  canSend,
  disabledReason,
  channelNote,
  onSend,
  onReaction,
}: {
  messages: ChatMessage[];
  youId: string;
  canSend: boolean;
  disabledReason?: string;
  /** شريط القناة الخاصة — زي قناة المافيا الليلية */
  channelNote?: string | null;
  onSend: (text: string) => void;
  /** ريأكشن إيموجي — بينبث لكل الأوضة فوق كارتك */
  onReaction?: (emojiId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, open]);

  const submit = () => {
    const text = draft.trim();
    if (!text || !canSend) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-2">
      <motion.div
        layout
        className="backdrop-blur-lg pointer-events-auto mx-auto mb-4 w-full max-w-4xl overflow-hidden rounded-xl border border-gold-500/20 bg-black/50"
      >
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div ref={listRef} className="max-h-52 space-y-2 overflow-y-auto px-3 py-3">
                {messages.length === 0 && (
                  <p className="py-4 text-center text-xs italic text-slate-600">
                    الأوضة ساكتة.. سكاتة أوي كده.
                  </p>
                )}
                {messages.map((message, index) => {
                  const mine = message.from.id === youId;
                  return (
                    <div key={`${message.at}-${index}`} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-1.5 text-sm ${
                          mine
                            ? 'border border-night-600/70 bg-night-800/80 text-slate-200'
                            : 'bg-blood-700/35 text-slate-100'
                        }`}
                      >
                        {!mine && (
                          <span className="mb-0.5 block text-[11px] font-bold text-gold-400">
                            {message.from.name}
                          </span>
                        )}
                        <p className="break-words">{message.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* شريط الريأكشنز — إيموجي 3D تنفجر فوق كارتك في الطاولة */}
        {onReaction && (
          <div className="flex items-center justify-center gap-1.5 border-b border-night-600/50 bg-night-900/40 px-2 py-1.5">
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => onReaction(r.id)}
                title={r.label}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent transition hover:scale-125 hover:border-gold-500/50 hover:bg-gold-500/10 active:scale-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.asset} alt={r.label} className="h-6 w-6 object-contain" />
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 px-3 py-2 text-right transition hover:bg-night-800/50"
        >
          <MessageSquare className={`h-4 w-4 shrink-0 ${GOLD_ICON}`} strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
            {last ? (
              <>
                <span className="font-bold text-slate-300">{last.from.name}:</span> {last.text}
              </>
            ) : (
              'همس المجلس.. قول اللي في قلبك'
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#d4af37] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] transition-transform ${open ? '' : 'rotate-180'}`}
            strokeWidth={1.5}
          />
        </button>

        <footer className="border-t border-night-600/50">
          {channelNote && (
            <p className="flex items-center justify-center gap-1.5 border-b border-blood-500/30 bg-blood-700/25 px-3 py-1.5 text-center text-[11px] font-bold text-blood-300">
              <VenetianMask className="h-3.5 w-3.5" strokeWidth={1.5} />
              {channelNote}
            </p>
          )}
          {canSend ? (
            <div className="flex gap-2 p-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && submit()}
                maxLength={280}
                placeholder="اكتب هنا..."
                className="min-w-0 flex-1 rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-gold-500/50"
              />
              <button
                onClick={submit}
                disabled={!draft.trim()}
                className={`${btn.gold} flex h-9 w-11 items-center justify-center rounded-lg disabled:hover:scale-100 disabled:hover:shadow-none`}
              >
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <p className="px-3 py-1.5 text-center text-[11px] italic text-blood-400">
              {disabledReason ?? 'لسانك وميكك مقفولين دلوقتي.'}
            </p>
          )}
        </footer>
      </motion.div>
    </div>
  );
}
