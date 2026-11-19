import { motion, useReducedMotion } from 'framer-motion';
import { ALERT_THRESHOLD, verdictFor, type Verdict } from '@ss/contracts';
import { SPRING } from './motionConfig';
import { VERDICT_LOOK } from './verdict';

// Green below 25, amber from 25, red from 50: the same cut-offs the engine uses for the verdict.
const FILL: Record<Verdict, string> = { SAFE: 'bg-safe', SUSPICIOUS: 'bg-suspicious', SCAM: 'bg-scam' };
const SCAM_FROM = 50;

/** Bar that springs to the current risk. The icon and word say the level, so colour is never alone. */
export function RiskMeter({ score }: { score: number }) {
  const level = verdictFor(score);
  const look = VERDICT_LOOK[level];
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-xl font-semibold ${look.cls.split(' ')[0]}`}>
        <span aria-hidden="true">{look.icon}</span> Risc: {look.short} · {score} din 100
      </p>
      <div
        role="meter"
        aria-label="Riscul până acum"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="relative h-6 rounded-full bg-ink/10"
      >
        <motion.div
          className={`h-full rounded-full ${FILL[level]}`}
          initial={false}
          animate={{ width: `${Math.min(100, score)}%` }}
          transition={reduce ? { duration: 0 } : SPRING}
        />
        {[ALERT_THRESHOLD, SCAM_FROM].map((mark) => (
          <span key={mark} aria-hidden="true" className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: `${mark}%` }} />
        ))}
      </div>
      <div aria-hidden="true" className="relative h-7 text-ink/70">
        {[ALERT_THRESHOLD, SCAM_FROM].map((mark) => (
          <span key={mark} className="absolute -translate-x-1/2" style={{ left: `${mark}%` }}>
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}
