import { motion, useReducedMotion } from 'framer-motion';

/** Calm waiting state. The pulse is decoration only; the words carry the meaning. */
export function Thinking() {
  const reduce = useReducedMotion();
  return (
    <p role="status" className="flex items-center justify-center gap-4 py-10 font-heading text-2xl">
      <motion.span
        aria-hidden="true"
        className="size-4 rounded-full bg-ink/60"
        animate={reduce ? undefined : { opacity: [0.35, 1, 0.35], scale: [0.9, 1.2, 0.9] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      Verificăm…
    </p>
  );
}
