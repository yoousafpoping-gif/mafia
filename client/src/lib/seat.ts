'use client';

import type { SeatRecord } from './types';

const sessionKeyFor = (code: string) => `mafia-seat:${code.toUpperCase()}`;
const legacyKeyFor = (code: string) => `mafia-seat-legacy:${code.toUpperCase()}`;

export function saveSeat(seat: SeatRecord) {
  try {
    window.sessionStorage.setItem(sessionKeyFor(seat.code), JSON.stringify(seat));
    window.localStorage.setItem(legacyKeyFor(seat.code), JSON.stringify(seat));
  } catch {
    /* storage unavailable */
  }
}

export function loadSeat(code: string): SeatRecord | null {
  const parse = (raw: string | null): SeatRecord | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SeatRecord;
      if (parsed.code && parsed.token && parsed.playerId) return parsed;
      return null;
    } catch {
      return null;
    }
  };

  try {
    const sessionSeat = parse(window.sessionStorage.getItem(sessionKeyFor(code)));
    if (sessionSeat) return sessionSeat;
  } catch {
    /* storage unavailable */
  }

  try {
    return parse(window.localStorage.getItem(legacyKeyFor(code)));
  } catch {
    return null;
  }
}

export function clearSeat(code: string) {
  try {
    window.sessionStorage.removeItem(sessionKeyFor(code));
  } catch {
    /* storage unavailable */
  }
  try {
    window.localStorage.removeItem(legacyKeyFor(code));
  } catch {
    /* storage unavailable */
  }
}
