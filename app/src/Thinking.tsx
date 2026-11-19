import { motion, useReducedMotion } from 'framer-motion';
import { ThiefFigure } from './ThiefFigure';

/** Waiting state: the thief tiptoes while the shield checks. The figure is decoration; the words carry the meaning. */
export function Thinking() {
  const reduce = useReducedMotion();
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 overflow-hidden rounded-card bg-linear-to-br from-night to-night-2 px-6 py-8 text-surface shadow-soft"
    >
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [-80, 80, 80, -80, -80], scaleX: [1, 1, -1, -1, 1] }}
        transition={{ duration: 4, times: [0, 0.45, 0.5, 0.95, 1], repeat: Infinity, ease: 'easeInOut' }}
      >
        <ThiefFigure mood="sneak" className="size-24 drop-shadow-lg" />
      </motion.div>
      <p className="font-heading text-2xl">Verificăm…</p>
      <p className="text-lg text-surface/80">Căutăm semnele unei înșelăciuni.</p>
    </div>
  );
}
