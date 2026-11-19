import type { Result, Scenario } from '@ss/contracts';
import { ThreadView } from './ThreadView';
import { Timeline } from './Timeline';
import { WarningCard } from './WarningCard';
import type { Lang } from './lang';
import { VERDICT_LOOK, scamTypeLabel } from './verdict';

interface ResultViewProps {
  result: Result;
  messages: Scenario['messages'];
  lang: Lang;
  onLang: (lang: Lang) => void;
}

export function ResultView({ result, messages, lang, onLang }: ResultViewProps) {
  const look = VERDICT_LOOK[result.verdict];
  return (
    <article className={`flex flex-col gap-5 rounded-card border-2 bg-surface p-5 ${look.cls}`}>
      <header>
        <h2 className="text-2xl font-semibold">
          <span aria-hidden="true">{look.icon}</span> {look.word}
        </h2>
        {result.verdict !== 'SAFE' && (
          <p className="text-ink">
            {scamTypeLabel(result.scamType)} · Scor {result.score} din 100
          </p>
        )}
      </header>
      <WarningCard warning={result.warning} lang={lang} onLang={onLang} />
      {messages.length > 1 && (
        <Timeline scores={result.timeline} firstAlert={result.firstAlert} />
      )}
      <div className="text-ink">
        <h3 className="mb-2 text-xl">De ce am spus asta</h3>
        <ThreadView messages={messages} hits={result.hits} />
      </div>
    </article>
  );
}
