'use client';

/**
 * Store catalog — single source of truth.
 * - Hardcoded fallback in `FALLBACK_CATALOG` (the current COSMETICS array).
 * - Firestore document: `store_catalog/items` containing `{ items: CosmeticItem[] }`.
 * - Module-level cache: fetched once per session, then served from memory.
 * - If Firestore fails, silently falls back to the hardcoded array.
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { COSMETICS, type CosmeticItem } from '@/lib/cosmetics';
export type { CosmeticItem } from '@/lib/cosmetics';

const COLLECTION = 'store_catalog';
const DOC_ID = 'items';

let cachedCatalog: CosmeticItem[] | null = null;

/** Returns the catalog — from cache, Firestore, or hardcoded fallback. */
export async function fetchStoreCatalog(): Promise<CosmeticItem[]> {
  if (cachedCatalog) return cachedCatalog;
  try {
    const db = firebaseDb;
    if (!db) throw new Error('no firestore');
    const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
    if (snap.exists()) {
      const data = snap.data() as { items?: CosmeticItem[] };
      if (Array.isArray(data.items) && data.items.length > 0) {
        cachedCatalog = data.items;
        return cachedCatalog;
      }
    }
  } catch {
    /* Firestore unavailable — use fallback */
  }
  cachedCatalog = COSMETICS;
  return cachedCatalog;
}

/** Returns the catalog synchronously — cache or hardcoded fallback. */
export function getCatalogSync(): CosmeticItem[] {
  return cachedCatalog ?? COSMETICS;
}

/** Seeds the Firestore document with the current hardcoded catalog. */
export async function seedStoreToFirestore(): Promise<{ count: number }> {
  const db = firebaseDb;
  if (!db) throw new Error('Firestore غير متاح');
  await setDoc(doc(db, COLLECTION, DOC_ID), {
    items: COSMETICS,
    seededAt: serverTimestamp(),
    version: 1,
  });
  cachedCatalog = COSMETICS;
  return { count: COSMETICS.length };
}

/** Returns whether Firestore was actually used (vs fallback). */
export function isCatalogFromFirestore(): boolean {
  return cachedCatalog !== null && cachedCatalog !== COSMETICS;
}
