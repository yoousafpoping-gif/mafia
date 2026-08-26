'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, MessageSquare, Send, VenetianMask } from 'lucide-react';
import { GOLD_ICON, btn } from '@/styles/themeConfig';
import { REACTIONS } from '@/lib/reactions';
import { frameImage, titleName } from '@/lib/cosmetics';
import { useAuth } from '@/context/AuthContext';
import type { ChatChannel, ChatMessage } from '@/lib/types';

export function ChatDock({
  isSidebarOpen,
  onToggleSidebar,
  isPanelOpen,
  onTogglePanel,
  messages,
  youId,
  canSend,
  disabledReason,
  channel,
  channelNote,
  onSend,
  onReaction,
}: {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  messages: ChatMessage[];
  youId: string;
  canSend: boolean;
  disabledReason?: string;
  channel: ChatChannel;
  /** شريط القناة الخاصة — زي قناة المافيا الليلية */
  channelNote?: string | null;
  onSend: (text: string, channel: ChatChannel) => void;
  /** ريأكشن إيموجي — بينبث لكل الأوضة فوق كارتك */
  onReaction?: (emojiId: string) => void;
}) {
  const open = isPanelOpen;
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  const { profile } = useAuth();
  // شريط الريأكشنز: المجاني للكل + اللي اشتراه من المتجر، والمجهّز يظهر أولًا كاختيار سريع
  const inventory = profile?.inventory ?? [];
  const equippedEmote = profile?.equipped.emote ?? null;
  const availableReactions = REACTIONS
    .filter((r) => !r.storeItem || inventory.includes(r.storeItem))
    .sort((a, b) => Number(b.storeItem === equippedEmote) - Number(a.storeItem === equippedEmote));

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, open]);

  const submit = () => {
    const text = draft.trim();
    if (!text || !canSend) return;
    onSend(text, channel);
    setDraft('');
  };

  return (
    <motion.div
      animate={{ x: isSidebarOpen ? 0 : '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="pointer-events-none absolute bottom-0 right-0 z-[60] w-full px-2"
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? 'إخفاء الشات' : 'إظهار الشات'}
        className="pointer-events-auto absolute right-full top-1/2 flex h-12 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-lg border border-amber-900/70 bg-neutral-900 text-amber-500 transition-all hover:bg-neutral-800 hover:shadow-[0_0_10px_rgba(245,158,11,0.3)]"
      >
        {isSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
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
                    <div key={`${message.at}-${index}`} className={`flex items-start gap-1.5 ${mine ? 'justify-start' : 'justify-end'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={frameImage(message.from.cosmetics?.cardFrame)}
                        alt=""
                        aria-hidden
                        className={`mt-0.5 h-9 w-6 shrink-0 select-none ${mine ? '' : 'order-2'}`}
                      />
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-1.5 text-sm ${
                          mine
                            ? 'border border-night-600/70 bg-night-800/80 text-slate-200'
                            : 'bg-blood-700/35 text-slate-100'
                        }`}
                      >
                        {!mine && (
                          <span className="mb-0.5 flex flex-wrap items-baseline gap-1 text-[11px] font-bold text-gold-400">
                            <span>{message.from.name}</span>
                            {titleName(message.from.cosmetics?.title) && (
                              <span className="rounded-full border border-gold-500/40 bg-gold-500/10 px-1.5 py-px text-[8px] font-black text-gold-300">
                                {titleName(message.from.cosmetics?.title)}
                              </span>
                            )}
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
        <AnimatePresence initial={false}>
          {open && onReaction && (
            <motion.div
              key="reactions"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-center gap-1.5 border-b border-night-600/50 bg-night-900/40 px-2 py-1.5">
                {availableReactions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onReaction(r.id)}
                    title={r.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border bg-transparent transition hover:scale-125 hover:border-gold-500/50 hover:bg-gold-500/10 active:scale-95 sm:h-8 sm:w-8 ${r.storeItem === equippedEmote ? 'border-gold-400/70 bg-gold-500/15 shadow-[0_0_12px_rgba(212,175,55,0.35)]' : 'border-transparent'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.asset} alt={r.label} className="h-7 w-7 object-contain sm:h-6 sm:w-6" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={onTogglePanel}
          aria-expanded={open}
          aria-label={open ? 'طي لوحة الشات' : 'فتح لوحة الشات'}
          className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-right transition hover:bg-night-800/50"
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

        <AnimatePresence initial={false}>
          {open && (
            <motion.footer
              key="composer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-night-600/50"
            >
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
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-base text-slate-200 placeholder-slate-600 outline-none focus:border-gold-500/50 sm:min-h-0 sm:py-1.5 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!draft.trim()}
                    className={`${btn.gold} flex h-11 w-12 items-center justify-center rounded-lg disabled:hover:scale-100 disabled:hover:shadow-none sm:h-9 sm:w-11`}
                  >
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <p className="px-3 py-2 text-center text-[11px] italic text-blood-400">
                  {disabledReason ?? 'لسانك وميكك مقفولين دلوقتي.'}
                </p>
              )}
            </motion.footer>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
