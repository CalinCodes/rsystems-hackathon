import type { Result, Scenario } from '@ss/contracts';
import { ChatThread } from './ChatThread';
import { ExtrasBar } from './ExtrasBar';
import { RiskMeter } from './RiskMeter';
import { WarningCard } from './WarningCard';
import type { Lang } from './lang';
import { scoreAt } from './replay';
import { useReplay } from './useReplay';
import { VERDICT_LOOK, scamTypeLabel } from './verdict';

interface DetailViewProps {
  scenario: Scenario;
  result: Result;
  lang: Lang;
  onLang: (lang: Lang) => void;
  onBack: () => void;
}

export function DetailView({ scenario, result, lang, onLang, onBack }: DetailViewProps) {
  const total = scenario.messages.length;
  const { shown, playing, play } = useReplay(total);
  const look = VERDICT_LOOK[result.verdict];
  // Fully shown means the final score, so the meter never disagrees with the verdict above it.
  const score = shown >= total ? result.score : scoreAt(result.timeline, shown);
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <button type="button" onClick={onBack} className="min-h-14 self-start rounded-card border-2 border-ink/30 bg-surface px-5 text-xl font-semibold">
        ← Înapoi la tabel
      </button>
      <header className={`flex flex-col gap-1 ${look.cls.split(' ')[0]}`}>
        <h2 className="text-3xl font-semibold">
          <span aria-hidden="true">{look.icon}</span> {scenario.id} · {look.short}
        </h2>
        {result.verdict !== 'SAFE' && <p className="text-xl text-ink/70">{scamTypeLabel(result.scamType)}</p>}
      </header>
      <WarningCard warning={result.warning} lang={lang} onLang={onLang} />
      <ExtrasBar result={result} />
      <section className="flex flex-col gap-4" aria-label="Riscul în timp">
        <RiskMeter score={score} />
        {total > 1 && (
          <button
            type="button"
            disabled={playing}
            onClick={play}
            className="min-h-14 self-start rounded-card bg-ink px-6 text-xl font-semibold text-surface disabled:opacity-50"
          >
            {playing ? 'Se redă…' : 'Redă conversația'}
          </button>
        )}
      </section>
      <ChatThread messages={scenario.messages} hits={result.hits} firstAlert={result.firstAlert} visible={shown} />
    </div>
  );
}
