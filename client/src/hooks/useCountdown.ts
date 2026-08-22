'use client';

import { useEffect, useState } from 'react';

export function useCountdown(deadline: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());

  const active = Boolean(deadline);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [active]);

  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
