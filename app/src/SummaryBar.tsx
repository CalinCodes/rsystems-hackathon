import { motion, useReducedMotion } from 'framer-motion';
import type { Verdict } from '@ss/contracts';
import { countVerdicts, type DossierRow, type Progress } from './dossier';
import { SPRING } from './motionConfig';
import { moodFor } from './thief';
import { ThiefFigure } from './ThiefFigure';
import { VERDICT_LOOK } from './verdict';

interface SummaryBarProps {
  rows: DossierRow[];
  progress: Progress;
}

const ORDER: Verdict[] = ['SCAM', 'SUSPICIOUS', 'SAFE'];

/** Totals above the table. Each count carries icon + word + colour, never colour alone. */
export function SummaryBar({ rows, progress }: SummaryBarProps) {
  const counts = countVerdicts(rows);
  const reduce = useReducedMotion();
  const running = progress.done < progress.total;
  const share = progress.total === 0 ? 0 : (progress.done / progress.total) * 100;
  return (
    <section aria-label="Rezumat" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <p className="font-heading text-3xl">
          {rows.length} {rows.length === 1 ? 'mesaj încărcat' : 'mesaje încărcate'}
        </p>
        {ORDER.map((v) => (
          <p key={v} className={`flex items-center gap-2 text-2xl font-semibold ${VERDICT_LOOK[v].cls.split(' ')[0]}`}>
            <ThiefFigure mood={moodFor(v)} className="size-12" />
            <span aria-hidden="true">{VERDICT_LOOK[v].icon}</span> {VERDICT_LOOK[v].short}: {counts[v]}
          </p>
        ))}
        {counts.ERROR > 0 && <p className="text-2xl font-semibold">✕ Nu pot citi: {counts.ERROR}</p>}
      </div>
      {running && (
        <div role="status" className="flex items-center gap-4">
          <p className="text-xl font-semibold">
            Verificăm… {progress.done} / {progress.total}
          </p>
          <div className="relative h-3 flex-1 rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-night-2 to-night"
              initial={false}
              animate={{ width: `${share}%` }}
              transition={reduce ? { duration: 0 } : SPRING}
            />
            {/* The thief runs ahead of the bar while the folder is checked. */}
            <motion.div
              aria-hidden="true"
              className="absolute -top-9 -ml-5"
              initial={false}
              animate={{ left: `${share}%` }}
              transition={reduce ? { duration: 0 } : SPRING}
            >
              <ThiefFigure mood="sneak" className="size-10" />
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
}
