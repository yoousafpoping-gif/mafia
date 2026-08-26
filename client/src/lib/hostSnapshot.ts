'use client';

import type { GameRoomSnapshot } from './engine/GameRoom';

export const HOST_SNAPSHOT_VERSION = 1;

export interface StoredHostSnapshot {
  version: typeof HOST_SNAPSHOT_VERSION;
  code: string;
  hostToken: string;
  isPublic: boolean;
  savedAt: number;
  engine: GameRoomSnapshot;
}

const keyFor = (code: string) => `mafia-host-snapshot:v${HOST_SNAPSHOT_VERSION}:${code.toUpperCase()}`;

export function saveHostSnapshot(snapshot: StoredHostSnapshot) {
  try {
    window.localStorage.setItem(keyFor(snapshot.code), JSON.stringify(snapshot));
  } catch {
    /* private storage unavailable */
  }
}

export function loadHostSnapshot(code: string): StoredHostSnapshot | null {
  try {
    const raw = window.localStorage.getItem(keyFor(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHostSnapshot;
    if (
      parsed.version !== HOST_SNAPSHOT_VERSION ||
      parsed.code !== code.toUpperCase() ||
      !parsed.hostToken ||
      parsed.engine?.version !== 1
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearHostSnapshot(code: string) {
  try {
    window.localStorage.removeItem(keyFor(code));
  } catch {
    /* private storage unavailable */
  }
}
