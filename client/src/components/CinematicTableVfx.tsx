'use client';

import { motion } from 'framer-motion';

const DUST_COUNT = 26;

function seededValue(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const DUST = Array.from({ length: DUST_COUNT }, (_, index) => ({
  id: index,
  left: seededValue(index, 1) * 100,
  top: 35 + seededValue(index, 2) * 70,
  size: 1 + seededValue(index, 3) * 2.4,
  drift: (seededValue(index, 4) - 0.5) * 150,
  rise: 180 + seededValue(index, 5) * 300,
  duration: 15 + seededValue(index, 6) * 10,
  delay: -seededValue(index, 7) * 25,
  opacity: 0.18 + seededValue(index, 8) * 0.32,
}));

export function CinematicTableVfx() {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {DUST.map((particle) => (
          <motion.span
            key={particle.id}
            className="absolute rounded-full bg-amber-100 shadow-[0_0_5px_rgba(255,235,190,0.45)]"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: particle.size,
              height: particle.size,
            }}
            animate={{
              x: [0, particle.drift * 0.35, particle.drift],
              y: [0, -particle.rise * 0.45, -particle.rise],
              opacity: [0, particle.opacity, particle.opacity * 0.65, 0],
              scale: [0.7, 1, 0.85],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.18, 0.72, 1],
            }}
          />
        ))}
      </div>
      <div aria-hidden className="cinematic-film-overlay pointer-events-none fixed inset-0 z-50" />
    </>
  );
}
