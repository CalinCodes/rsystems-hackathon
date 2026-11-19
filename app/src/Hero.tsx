import { motion, useReducedMotion } from 'framer-motion';
import { ThiefFigure } from './ThiefFigure';

// Fixed star positions: the same picture on every load (no randomness at runtime).
const STARS = [
  'left-1/12 top-1/6',
  'left-1/5 top-2/3',
  'left-2/5 top-1/8',
  'left-11/20 top-1/3',
  'left-2/3 top-1/12',
  'left-5/6 top-1/4',
  'left-11/12 top-3/5',
];

/** Night scene: a searchlight sweeps and finds the sneaking thief. Purely decorative; the words are the header. */
function Stage() {
  const reduce = useReducedMotion();
  const loop = { duration: 9, repeat: Infinity, ease: 'easeInOut' } as const;
  return (
    <div aria-hidden="true" className="relative h-36 w-44 shrink-0 md:h-40 md:w-52">
      <motion.div
        className="absolute left-1/2 top-0 h-full w-40 origin-top -translate-x-1/2 bg-linear-to-b from-spot/0 via-spot/25 to-spot/50 searchlight"
        animate={reduce ? undefined : { rotate: [-16, 16, 16, -16, -16] }}
        transition={{ ...loop, times: [0, 0.45, 0.5, 0.95, 1] }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 -ml-12"
        animate={reduce ? undefined : { x: [-40, 40, 40, -40, -40], scaleX: [1, 1, -1, -1, 1] }}
        transition={{ ...loop, times: [0, 0.45, 0.5, 0.95, 1] }}
      >
        <ThiefFigure mood="sneak" className="size-24 drop-shadow-lg" />
      </motion.div>
    </div>
  );
}

export function Hero() {
  return (
    <header className="relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-container bg-linear-to-br from-night to-night-2 px-6 pt-8 text-surface shadow-soft sm:flex-row sm:items-end sm:justify-between md:px-10">
      {STARS.map((pos, i) => (
        <span
          key={pos}
          aria-hidden="true"
          className={`absolute size-1.5 rounded-full bg-surface/70 animate-twinkle motion-reduce:animate-none ${pos}`}
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}
      <div className="relative flex min-w-0 flex-1 flex-col gap-3 pb-8">
        <p className="flex items-center gap-2 text-base font-semibold uppercase tracking-widest text-spot">
          <span aria-hidden="true">🛡️</span> Paznicul mesajelor
        </p>
        <h1 className="text-5xl">Scam Shield</h1>
        <p className="max-w-md text-xl text-surface/85">Verificăm mesajele și vă spunem ce să faceți.</p>
      </div>
      <Stage />
    </header>
  );
}
