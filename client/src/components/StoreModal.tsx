'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Coins,
  Crown,
  Gem,
  Gift,
  Image as ImageIcon,
  Loader2,
  Package,
  ShoppingBag,
  Smile,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth, type PlayerProfile } from '@/context/AuthContext';
import { claimGuestDaily, guestDailyInfo } from '@/lib/guestProfile';
import {
  purchaseFirestore,
  equipFirestore,
  openBoxFirestore,
  claimDailyGiftFirestore,
  convertCoinsFirestore,
  buildDailyInfo,
  fetchProfile,
  type BoxResult,
} from '@/lib/profileFirestore';
import { fetchStoreCatalog, seedStoreToFirestore, type CosmeticItem } from '@/lib/storeCatalog';
import {
  RARITY_BADGE,
  RARITY_LABEL,
  cosmeticById,
} from '@/lib/cosmetics';

type StoreTab = 'cardFrame' | 'title' | 'emote' | 'background' | 'lootBox' | 'daily';

const TABS: { key: StoreTab; label: string; icon: typeof ShoppingBag }[] = [
  { key: 'cardFrame', label: 'الإطارات', icon: Sparkles },
  { key: 'title', label: 'الألقاب', icon: Crown },
  { key: 'emote', label: 'الإيموجي', icon: Smile },
  { key: 'background', label: 'الخلفيات', icon: ImageIcon },
  { key: 'lootBox', label: 'الصناديق', icon: Package },
  { key: 'daily', label: 'يومي', icon: Gift },
];

interface DailyDeal {
  itemId: string;
  price: number;
  originalPrice: number;
}

interface DailyInfo {
  dayKey: string;
  deals: DailyDeal[];
  gift: { claimable: boolean; streak: number; canKeepStreak: boolean; nextCoins: number; nextGems: number };
}

const ARABIC_ERRORS: Record<string, string> = {
  INSUFFICIENT_COINS: 'رصيد الكوينز مش كفاية',
  INSUFFICIENT_GEMS: 'الجواهر مش كفاية',
  ALREADY_OWNED: 'عندك العنصر ده بالفعل',
  DAILY_CLAIMED: 'استلمت هدية النهاردة خلاص — ارجع بكرة',
  ITEM_NOT_FOUND: 'العنصر مش موجود',
  ITEM_NOT_OWNED: 'مش مالك العنصر ده',
};

export function StoreModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, setProfile, updateGuestProfile } = useAuth();
  const isGuest = user?.provider === 'guest';
  const [tab, setTab] = useState<StoreTab>('cardFrame');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [boxResult, setBoxResult] = useState<{ box: CosmeticItem; result: BoxResult } | null>(null);
  const [catalog, setCatalog] = useState<CosmeticItem[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTab('cardFrame');
      setError('');
      setBoxResult(null);
      return;
    }
    if (catalog) return;
    setCatalogLoading(true);
    fetchStoreCatalog()
      .then((items) => {
        setCatalog(items);
        if (items.length === 0) return seedStoreToFirestore().then(() => fetchStoreCatalog());
        return undefined;
      })
      .then((items) => { if (items) setCatalog(items); })
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [open, catalog]);

  useEffect(() => {
    if (!open || !catalog) return;
    console.log('[StoreModal] opened — isGuest:', isGuest, 'profile:', profile ?? 'null');
    if (isGuest) {
      if (profile) setDaily(guestDailyInfo(profile, catalog));
      return;
    }
    if (profile) setDaily(buildDailyInfo(profile));
  }, [open, isGuest, catalog]);

  const inventory = useMemo(() => new Set(profile?.inventory ?? []), [profile]);
  const dealByItem = useMemo(() => {
    const map = new Map<string, DailyDeal>();
    for (const deal of daily?.deals ?? []) map.set(deal.itemId, deal);
    return map;
  }, [daily]);

  const owned = (id: string) => inventory.has(id);
  const equipped = (id: string) => Object.values(profile?.equipped ?? {}).includes(id);

  const act = async (action: 'purchase' | 'equip', item: CosmeticItem) => {
    setBusy(`${action}:${item.id}`);
    setError('');
    try {
      if (isGuest) {
        updateGuestProfile((current) => {
          if (action === 'equip') {
            if (!current.inventory.includes(item.id)) throw new Error('ITEM_NOT_OWNED');
            return { ...current, equipped: { ...current.equipped, [item.type]: item.id } } as PlayerProfile;
          }
          if (current.inventory.includes(item.id)) throw new Error('ALREADY_OWNED');
          const price = dealByItem.get(item.id)?.price ?? item.price;
          if (item.currency === 'gems' && current.gems < price) throw new Error('INSUFFICIENT_GEMS');
          if (item.currency === 'coins' && current.coins < price) throw new Error('INSUFFICIENT_COINS');
          return {
            ...current,
            coins: item.currency === 'coins' ? current.coins - price : current.coins,
            gems: item.currency === 'gems' ? current.gems - price : current.gems,
            inventory: [...current.inventory, item.id],
          };
        });
      } else {
        const next = action === 'purchase'
          ? await purchaseFirestore(user!.uid, item.id)
          : await equipFirestore(user!.uid, item.id);
        setProfile(next);
        setDaily(buildDailyInfo(next));
      }
    } catch (err) {
      setError(ARABIC_ERRORS[err instanceof Error ? err.message : ''] ?? 'العملية فشلت — جرب تاني');
    } finally {
      setBusy('');
    }
  };

  const openBox = async (box: CosmeticItem) => {
    setBusy(`box:${box.id}`);
    setError('');
    try {
      if (isGuest) {
        let localResult: BoxResult = { won: null, rarity: null, refund: null, refundCurrency: null };
        updateGuestProfile((current) => {
          if (box.currency === 'gems' && current.gems < box.price) throw new Error('INSUFFICIENT_GEMS');
          if (box.currency === 'coins' && current.coins < box.price) throw new Error('INSUFFICIENT_COINS');
          const available = (catalog ?? []).filter((item) => item.type !== 'lootBox' && !current.inventory.includes(item.id));
          const won = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
          const refund = won ? 0 : Math.max(1, Math.floor(box.price / 2));
          localResult = won
            ? { won: won.id, rarity: won.rarity, refund: null, refundCurrency: null }
            : { won: null, rarity: null, refund, refundCurrency: box.currency };
          return {
            ...current,
            coins: box.currency === 'coins' ? current.coins - box.price + (won ? 0 : refund) : current.coins,
            gems: box.currency === 'gems' ? current.gems - box.price + (won ? 0 : refund) : current.gems,
            inventory: won ? [...current.inventory, won.id] : current.inventory,
          };
        });
        setBoxResult({ box, result: localResult });
      } else {
        const result = await openBoxFirestore(user!.uid, box.id);
        const fresh = await fetchProfile(user!.uid);
        if (fresh) setProfile(fresh);
        setBoxResult({ box, result });
      }
    } catch (err) {
      setError(ARABIC_ERRORS[err instanceof Error ? err.message : ''] ?? 'فتح الصندوق فشل');
    } finally {
      setBusy('');
    }
  };

  const claimDaily = async () => {
    setBusy('daily');
    setError('');
    try {
      if (isGuest) {
        updateGuestProfile((current) => claimGuestDaily(current));
      } else {
        const next = await claimDailyGiftFirestore(user!.uid);
        setProfile(next);
        setDaily(buildDailyInfo(next));
      }
    } catch (err) {
      setError(ARABIC_ERRORS[err instanceof Error ? err.message : ''] ?? 'استلام الهدية فشل');
    } finally {
      setBusy('');
    }
  };

  const convert = async () => {
    setBusy('convert');
    setError('');
    try {
      if (isGuest) {
        updateGuestProfile((current) => {
          if (current.coins < 500) throw new Error('INSUFFICIENT_COINS');
          return { ...current, coins: current.coins - 500, gems: current.gems + 5 };
        });
      } else {
        const next = await convertCoinsFirestore(user!.uid);
        setProfile(next);
      }
    } catch (err) {
      setError(ARABIC_ERRORS[err instanceof Error ? err.message : ''] ?? 'التحويل فشل');
    } finally {
      setBusy('');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-night-950/85 p-2 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="leather-bg flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gold-500/40 shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_30px_rgba(212,175,55,0.12)]"
          >
            {/* الهيدر: العنوان + الرصيدين */}
            <header className="flex items-center gap-2 border-b border-gold-500/20 px-4 py-3">
              <h2 className="flex min-w-0 items-center gap-2 font-serif text-lg font-black text-gold-200">
                <ShoppingBag className="h-5 w-5 shrink-0 text-gold-400" />
                المتجر التجميلي
              </h2>
              <div className="flex-1" />
              <span className="flex items-center gap-1 rounded-full border border-gold-500/40 bg-black/40 px-2.5 py-1 font-mono text-xs font-bold text-gold-300">
                <Coins className="h-3.5 w-3.5" /> {profile?.coins ?? 0}
              </span>
              <span className="flex items-center gap-1 rounded-full border border-cyan-400/40 bg-black/40 px-2.5 py-1 font-mono text-xs font-bold text-cyan-300">
                <Gem className="h-3.5 w-3.5" /> {profile?.gems ?? 0}
              </span>
              <button
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-night-600 bg-night-800 text-slate-400 transition hover:border-blood-500/60 hover:text-slate-100"
                aria-label="اقفل المتجر"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* التبويبات */}
            <div className="custom-scrollbar flex gap-1 overflow-x-auto border-b border-night-600/50 px-3 pt-2">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => { setTab(key); setError(''); }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-sm font-bold transition ${
                    tab === key
                      ? 'border-x border-t border-gold-500/50 bg-night-900/80 text-gold-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <p className="mx-4 mt-3 rounded-lg border border-blood-500/50 bg-blood-900/30 px-3 py-2 text-center text-xs font-bold text-blood-200">
                {error}
              </p>
            )}

            <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
              {catalogLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gold-300">
                  <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
                  <span className="text-sm">جاري تحميل المتجر...</span>
                </div>
              )}

              {!catalogLoading && catalog && (
                <>
                  {tab === 'cardFrame' && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {catalog.filter((i) => i.type === 'cardFrame').map((item) => (
                    <FrameTile
                      key={item.id}
                      item={item}
                      deal={dealByItem.get(item.id) ?? null}
                      isOwned={owned(item.id)}
                      isEquipped={equipped(item.id)}
                      busy={busy === `purchase:${item.id}` || busy === `equip:${item.id}`}
                      onAct={() => void act(owned(item.id) ? 'equip' : 'purchase', item)}
                    />
                  ))}
                </div>
              )}

              {tab === 'title' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {catalog.filter((i) => i.type === 'title').map((item) => (
                    <RowTile
                      key={item.id}
                      item={item}
                      deal={dealByItem.get(item.id) ?? null}
                      isOwned={owned(item.id)}
                      isEquipped={equipped(item.id)}
                      busy={busy === `purchase:${item.id}` || busy === `equip:${item.id}`}
                      onAct={() => void act(owned(item.id) ? 'equip' : 'purchase', item)}
                      icon={<Crown className="h-8 w-8 text-gold-300" />}
                    />
                  ))}
                </div>
              )}

              {tab === 'emote' && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {catalog.filter((i) => i.type === 'emote').map((item) => (
                    <EmoteTile key={item.id} item={item} isOwned={owned(item.id)} busy={busy === `purchase:${item.id}`} onAct={() => void act('purchase', item)} />
                  ))}
                </div>
              )}

              {tab === 'background' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {catalog.filter((i) => i.type === 'background').map((item) => (
                    <BackgroundTile
                      key={item.id}
                      item={item}
                      deal={dealByItem.get(item.id) ?? null}
                      isOwned={owned(item.id)}
                      isEquipped={equipped(item.id)}
                      busy={busy === `purchase:${item.id}` || busy === `equip:${item.id}`}
                      onAct={() => void act(owned(item.id) ? 'equip' : 'purchase', item)}
                    />
                  ))}
                </div>
              )}

              {tab === 'lootBox' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {catalog.filter((i) => i.type === 'lootBox').map((box) => (
                    <BoxCard key={box.id} box={box} busy={busy === `box:${box.id}`} onOpen={() => void openBox(box)} />
                  ))}
                  <p className="col-span-full mt-1 text-center text-[11px] text-slate-500">
                    الصندوق بيديك عنصر عشوائي مش مملوك لك — لو كل العناصر مملوكة بيرجّع نص تمنه
                  </p>
                </div>
              )}

              {tab === 'daily' && (
                <DailyTab daily={daily} busy={busy} onClaim={() => void claimDaily()} onConvert={() => void convert()} />
              )}
                </>
              )}
            </div>

            {/* كشف نتيجة الصندوق */}
            <AnimatePresence>
              {boxResult && (
                <BoxReveal
                  result={boxResult}
                  onClose={() => setBoxResult(null)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- عناصر العرض ---------------- */

function PriceTag({ item, deal }: { item: CosmeticItem; deal: DailyDeal | null }) {
  if (item.price === 0) return <span className="text-xs font-bold text-emerald-300">مجاني</span>;
  if (deal) {
    return (
      <span className="flex items-center justify-center gap-1.5 text-sm font-black">
        <span className="font-mono text-[10px] text-slate-500 line-through">{deal.originalPrice}</span>
        <span className={`flex items-center gap-1 ${item.currency === 'gems' ? 'text-cyan-300' : 'text-gold-300'}`}>
          {deal.price}
          {item.currency === 'gems' ? <Gem className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5" />}
        </span>
        <span className="rounded bg-blood-600/30 px-1 text-[9px] font-bold text-blood-200">-30٪</span>
      </span>
    );
  }
  return (
    <span className={`flex items-center justify-center gap-1 text-sm font-black ${item.currency === 'gems' ? 'text-cyan-300' : 'text-gold-300'}`}>
      {item.price}
      {item.currency === 'gems' ? <Gem className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5" />}
    </span>
  );
}

function RarityBadge({ rarity }: { rarity: CosmeticItem['rarity'] }) {
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${RARITY_BADGE[rarity]}`}>
      {RARITY_LABEL[rarity]}
    </span>
  );
}

function ActionButton({
  item, isOwned, isEquipped, busy, onAct, ownedLabel,
}: {
  item: CosmeticItem;
  isOwned: boolean;
  isEquipped: boolean;
  busy: boolean;
  onAct: () => void;
  ownedLabel?: string;
}) {
  return (
    <button
      disabled={busy || isEquipped}
      onClick={onAct}
      className={`mt-2 flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition disabled:cursor-not-allowed ${
        isEquipped
          ? 'bg-emerald-600/20 text-emerald-300'
          : isOwned
            ? 'bg-gold-500/20 text-gold-300 enabled:hover:bg-gold-500/30'
            : 'bg-gradient-to-l from-blood-800 to-blood-600 text-white enabled:hover:shadow-[0_0_18px_rgba(220,38,38,0.4)]'
      }`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isEquipped ? (
        'مجهّز ✓'
      ) : isOwned ? (
        ownedLabel ?? 'تجهيز'
      ) : (
        <PriceTag item={item} deal={null} />
      )}
    </button>
  );
}

/** معاينة إطار على كارت حقيقي — ظهر الكارت + صورة الإطار فوقه */
function FrameTile({
  item, deal, isOwned, isEquipped, busy, onAct,
}: {
  item: CosmeticItem;
  deal: DailyDeal | null;
  isOwned: boolean;
  isEquipped: boolean;
  busy: boolean;
  onAct: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center rounded-xl border bg-black/30 p-2.5 transition ${
        isEquipped ? 'border-emerald-500/50' : 'border-white/10 enabled:hover:border-gold-400/40'
      }`}
    >
      <div className="relative mb-2 h-32 w-[5.5rem] overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.7)]">
        <div className="absolute inset-0 bg-[url('/assets/cards/card-back.jpg')] bg-cover bg-center" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt={item.name} className="absolute inset-0 h-full w-full" />
        {isEquipped && (
          <span className="absolute right-1 top-1 rounded-full bg-emerald-600/90 px-1.5 text-[8px] font-bold text-white">مجهّز</span>
        )}
      </div>
      <p className="line-clamp-1 text-xs font-bold text-slate-100">{item.name}</p>
      <div className="mt-1 flex items-center gap-1">
        <RarityBadge rarity={item.rarity} />
        {deal && !isOwned && <span className="rounded bg-blood-600/30 px-1 text-[9px] font-bold text-blood-200">عرض اليوم</span>}
      </div>
      {deal && !isOwned ? (
        <button
          disabled={busy || isEquipped}
          onClick={onAct}
          className="mt-2 flex min-h-[34px] w-full items-center justify-center rounded-lg bg-gradient-to-l from-blood-800 to-blood-600 py-1.5 text-xs font-bold text-white transition enabled:hover:shadow-[0_0_18px_rgba(220,38,38,0.4)] disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PriceTag item={item} deal={deal} />}
        </button>
      ) : (
        <ActionButton item={item} isOwned={isOwned} isEquipped={isEquipped} busy={busy} onAct={onAct} />
      )}
    </motion.div>
  );
}

function RowTile({
  item, deal, isOwned, isEquipped, busy, onAct, icon,
}: {
  item: CosmeticItem;
  deal: DailyDeal | null;
  isOwned: boolean;
  isEquipped: boolean;
  busy: boolean;
  onAct: () => void;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 rounded-xl border bg-black/30 p-3 transition ${
        isEquipped ? 'border-emerald-500/50' : 'border-white/10 hover:border-gold-400/40'
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold-500/30 bg-night-900/70">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-slate-100">{item.name}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <RarityBadge rarity={item.rarity} />
          {deal && !isOwned && <span className="rounded bg-blood-600/30 px-1 text-[9px] font-bold text-blood-200">عرض اليوم -30٪</span>}
        </div>
      </div>
      <div className="w-24 shrink-0">
        <ActionButton item={item} isOwned={isOwned} isEquipped={isEquipped} busy={busy} onAct={onAct} />
        {deal && !isOwned && !busy && !isEquipped && (
          <p className="mt-1 text-center font-mono text-[10px] text-slate-500 line-through">{deal.originalPrice}</p>
        )}
      </div>
    </motion.div>
  );
}

function EmoteTile({
  item, isOwned, busy, onAct,
}: {
  item: CosmeticItem;
  isOwned: boolean;
  busy: boolean;
  onAct: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-xl border border-white/10 bg-black/30 p-3 transition hover:border-gold-400/40"
    >
      <span className="relative mb-2 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(212,175,55,0.3),_transparent_70%)] blur-md" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt={item.name} className="relative h-14 w-14 object-contain drop-shadow-[0_0_10px_rgba(212,175,55,0.4)]" />
      </span>
      <p className="text-xs font-bold text-slate-100">{item.name}</p>
      <RarityBadge rarity={item.rarity} />
      {isOwned ? (
        <span className="mt-2 flex min-h-[34px] w-full items-center justify-center rounded-lg bg-emerald-600/20 py-1.5 text-xs font-bold text-emerald-300">
          متاح في الريأكشنز ✓
        </span>
      ) : (
        <button
          disabled={busy}
          onClick={onAct}
          className="mt-2 flex min-h-[34px] w-full items-center justify-center rounded-lg bg-gradient-to-l from-blood-800 to-blood-600 py-1.5 text-xs font-bold text-white transition enabled:hover:shadow-[0_0_18px_rgba(220,38,38,0.4)] disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PriceTag item={item} deal={null} />}
        </button>
      )}
    </motion.div>
  );
}

function BackgroundTile({
  item, deal, isOwned, isEquipped, busy, onAct,
}: {
  item: CosmeticItem;
  deal: DailyDeal | null;
  isOwned: boolean;
  isEquipped: boolean;
  busy: boolean;
  onAct: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-xl border bg-black/30 transition ${
        isEquipped ? 'border-emerald-500/50' : 'border-white/10 hover:border-gold-400/40'
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        {isEquipped && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white">مجهّزة</span>
        )}
        <span className="absolute bottom-2 right-2">
          <RarityBadge rarity={item.rarity} />
        </span>
      </div>
      <div className="flex items-center gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-100">{item.name}</p>
          <p className="text-[10px] text-slate-500">خلفية ترابيزتك — إنت بس اللي بتشوفها</p>
        </div>
        <div className="w-24 shrink-0">
          <ActionButton item={item} isOwned={isOwned} isEquipped={isEquipped} busy={busy} onAct={onAct} />
          {deal && !isOwned && !busy && !isEquipped && (
            <p className="mt-1 text-center font-mono text-[10px] text-slate-500 line-through">{deal.originalPrice}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- الصناديق ---------------- */

function BoxCard({ box, busy, onOpen }: { box: CosmeticItem; busy: boolean; onOpen: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={busy ? undefined : { y: -4 }}
      className="flex flex-col items-center rounded-xl border border-white/10 bg-black/30 p-3 text-center transition hover:border-gold-400/40"
    >
      <motion.span
        animate={busy ? { rotate: [0, -6, 6, -6, 6, 0], scale: [1, 1.06, 1] } : {}}
        transition={busy ? { repeat: Infinity, duration: 0.55 } : {}}
        className="mb-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={box.image} alt={box.name} className="h-28 w-28 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]" />
      </motion.span>
      <p className="font-bold text-slate-100">{box.name}</p>
      <RarityBadge rarity={box.rarity} />
      <div className="mt-1.5 flex w-full flex-col gap-0.5 text-[9px] text-slate-500">
        {(Object.entries(box.odds ?? {}) as [string, number][])
          .filter(([, pct]) => pct > 0)
          .map(([rarity, pct]) => (
            <span key={rarity} className="flex justify-between">
              <span>{RARITY_LABEL[rarity as keyof typeof RARITY_LABEL]}</span>
              <span className="font-mono">{pct}٪</span>
            </span>
          ))}
      </div>
      <button
        disabled={busy}
        onClick={onOpen}
        className="mt-2 flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-l from-gold-700 to-gold-500 py-1.5 text-xs font-black text-night-950 transition enabled:hover:shadow-[0_0_20px_rgba(229,181,103,0.45)] disabled:cursor-not-wait"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PriceTag item={box} deal={null} />}
      </button>
    </motion.div>
  );
}

function BoxReveal({ result, onClose }: { result: { box: CosmeticItem; result: BoxResult }; onClose: () => void }) {
  const wonItem = cosmeticById(result.result.won);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.4, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-w-xs flex-col items-center gap-2 rounded-2xl border border-gold-500/40 bg-night-950/95 p-6 text-center"
      >
        {/* شعاع انفجار */}
        <motion.span
          aria-hidden
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.9 }}
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(212,175,55,0.5),_transparent_65%)]"
        />
        {wonItem ? (
          <>
            <p className="text-sm font-bold text-slate-400">{result.box.name} فتح!</p>
            <span className="relative flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(212,175,55,0.35),_transparent_70%)] blur-lg" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wonItem.image ?? '/assets/frames/frame-classic.svg'}
                alt={wonItem.name}
                className="relative h-20 w-20 object-contain drop-shadow-[0_0_16px_rgba(212,175,55,0.5)]"
              />
            </span>
            <p className="font-serif text-lg font-black text-gold-200">{wonItem.name}</p>
            <RarityBadge rarity={wonItem.rarity} />
            <p className="text-[11px] text-slate-500">اتضاف لمخزنك — جهّزه من التبويبات</p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-slate-400">{result.box.name} فتح!</p>
            <Coins className="h-16 w-16 text-gold-300" />
            <p className="font-serif text-lg font-black text-gold-200">
              استرداد {result.result.refund} {result.result.refundCurrency === 'gems' ? 'جواهر' : 'كوينز'}
            </p>
            <p className="text-[11px] text-slate-500">كل العناصر مملوكة لك — الصندوق رجّع نص تمنه</p>
          </>
        )}
        <button
          onClick={onClose}
          className="mt-2 rounded-lg bg-gold-500/20 px-6 py-2 text-sm font-bold text-gold-300 transition hover:bg-gold-500/30"
        >
          تمام
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- التبويب اليومي ---------------- */

function DailyTab({
  daily, busy, onClaim, onConvert,
}: {
  daily: DailyInfo | null;
  busy: string;
  onClaim: () => void;
  onConvert: () => void;
}) {
  const gift = daily?.gift;
  const streak = gift?.streak ?? 0;
  return (
    <div className="space-y-4">
      {/* الهدية اليومية */}
      <div className="rounded-xl border border-gold-500/30 bg-black/30 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-serif text-base font-black text-gold-200">
          <Gift className="h-4.5 w-4.5 text-gold-400" />
          هدية كل يوم
        </h3>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <motion.div
            animate={gift?.claimable ? { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] } : {}}
            transition={gift?.claimable ? { repeat: Infinity, duration: 2.4 } : {}}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center"
          >
            <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle,_rgba(212,175,55,0.4),_transparent_70%)] blur-md" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/boxes/box-golden.svg" alt="هدية يومية" className="relative h-20 w-20 object-contain" />
          </motion.div>
          <div className="min-w-0 flex-1 text-center sm:text-right">
            <p className="text-sm font-bold text-slate-200">
              {gift?.claimable
                ? `النهاردة: ${gift.nextCoins} كوينز${gift.nextGems > 0 ? ` + ${gift.nextGems} جواهر 🎁` : ''}`
                : gift
                  ? 'استلمت هدية النهاردة ✓ ارجع بكرة تكمل السلسلة'
                  : 'سجّع المعلومة اليومية من السيرفر...'}
            </p>
            {/* نقاط السلسلة — 7 أيام */}
            <div className="mt-2 flex justify-center gap-1.5 sm:justify-start">
              {Array.from({ length: 7 }, (_, i) => (
                <span
                  key={i}
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${
                    i < (streak % 7 === 0 && streak > 0 ? 7 : streak % 7)
                      ? 'border-gold-400/70 bg-gold-500/25 text-gold-200'
                      : 'border-slate-600/50 bg-black/30 text-slate-600'
                  }`}
                >
                  {i === 6 ? '💎' : i + 1}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              سلسلتك الحالية: {streak} يوم — كل يوم متوالي بيزود المكافأة، ويوم 7 معاه جواهر
            </p>
          </div>
          <button
            disabled={!gift?.claimable || busy === 'daily'}
            onClick={onClaim}
            className="flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl bg-gradient-to-l from-gold-700 to-gold-500 px-5 text-sm font-black text-night-950 transition enabled:hover:shadow-[0_0_22px_rgba(229,181,103,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'daily' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {gift?.claimable ? 'استلم' : 'تمّت'}
          </button>
        </div>
      </div>

      {/* عروض اليوم */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 font-serif text-base font-black text-gold-200">
          <Sparkles className="h-4.5 w-4.5 text-gold-400" />
          عروض النهاردة — بتنتهي نص الليل
        </h3>
        {daily ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {daily.deals.map((deal) => {
              const item = cosmeticById(deal.itemId);
              if (!item) return null;
              return (
                <div key={deal.itemId} className="flex items-center gap-2.5 rounded-xl border border-blood-500/30 bg-blood-900/15 p-2.5">
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <Crown className="h-6 w-6 text-gold-300" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-100">{item.name}</p>
                    <p className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[10px] text-slate-500 line-through">{deal.originalPrice}</span>
                      <span className="text-sm font-black text-gold-300">{deal.price}</span>
                    </p>
                  </div>
                  <span className="rounded bg-blood-600/40 px-1.5 py-0.5 text-[9px] font-black text-blood-200">-30٪</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-center text-xs text-slate-500">
            العروض بتتحمّل من السيرفر...
          </p>
        )}
      </div>

      {/* صرافة الدون */}
      <div className="flex items-center gap-3 rounded-xl border border-cyan-400/25 bg-cyan-950/20 p-3.5">
        <ArrowLeftRight className="h-5 w-5 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-200">صرافة الدون</p>
          <p className="text-[11px] text-slate-500">حوّل 500 كوينز لـ 5 جواهر — العملة النادرة للأسطوريات والصناديق</p>
        </div>
        <button
          disabled={busy === 'convert'}
          onClick={onConvert}
          className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-4 text-xs font-black text-cyan-200 transition enabled:hover:bg-cyan-500/25 disabled:cursor-not-wait"
        >
          {busy === 'convert' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حوّل'}
        </button>
      </div>
    </div>
  );
}
