import type { Result, Scenario } from '@ss/contracts';
import { motion, useReducedMotion } from 'framer-motion';
import { ExtrasBar } from './ExtrasBar';
import { flagLabel } from './flags';
import { ThreadView } from './ThreadView';
import { Timeline } from './Timeline';
import { WarningCard } from './WarningCard';
import type { Lang } from './lang';
import { SPRING } from './motionConfig';
import { moodFor } from './thief';
import { ThiefFigure } from './ThiefFigure';
import { VERDICT_LOOK, scamTypeLabel } from './verdict';

interface ResultCardProps {
  result: Result;
  messages: Scenario['messages'];
  lang: Lang;
  onLang: (lang: Lang) => void;
}

export function ResultCard({ result, messages, lang, onLang }: ResultCardProps) {
  const look = VERDICT_LOOK[result.verdict];
  const reduce = useReducedMotion();
  const flags = [...new Set(result.hits.map((h) => h.flag))];
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className={`flex flex-col gap-8 rounded-card border-2 bg-surface p-8 shadow-soft ${look.cls}`}
    >
      <div className="flex items-center gap-5">
        <motion.div
          initial={reduce ? false : { scale: 0.5, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.15 }}
          className="shrink-0"
        >
          <ThiefFigure mood={moodFor(result.verdict)} className="size-24 md:size-32" />
        </motion.div>
        <h2 className="text-3xl font-semibold md:text-4xl">
          <span aria-hidden="true">{look.icon}</span> {look.word}
        </h2>
      </div>
      <WarningCard warning={result.warning} lang={lang} onLang={onLang} />
      <ExtrasBar result={result} />
      <div className="flex flex-col gap-2 text-ink/70">
        <p>
          {result.verdict === 'SAFE' ? 'Niciun semn de alarmă' : scamTypeLabel(result.scamType)} · Scor{' '}
          {result.score} din 100
        </p>
        {flags.length > 0 && <p>Semnale: {flags.map(flagLabel).join(', ')}</p>}
      </div>
      <details className="text-ink">
        <summary className="min-h-12 cursor-pointer py-2 font-semibold">De ce am spus asta</summary>
        <div className="mt-4 flex flex-col gap-6">
          {messages.length > 1 && <Timeline scores={result.timeline} firstAlert={result.firstAlert} />}
          <ThreadView messages={messages} hits={result.hits} />
        </div>
      </details>
    </motion.article>
  );
}
