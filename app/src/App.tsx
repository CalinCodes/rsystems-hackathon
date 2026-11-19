import { useState } from 'react';
import type { Result, Scenario } from '@ss/contracts';
import { analyze } from '@ss/engine';
import { PasteForm } from './PasteForm';
import { ResultView } from './ResultView';
import type { Lang } from './lang';
import { buildScenario, type PasteInput } from './scenario';

interface Shown {
  result: Result;
  messages: Scenario['messages'];
}

export function App() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [lang, setLang] = useState<Lang>('ro');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(input: PasteInput) {
    const scenario = buildScenario(input);
    if (scenario.messages.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setShown({ result: await analyze(scenario), messages: scenario.messages });
    } catch {
      // Never show a raw error (it could echo message text); the reader just needs to know to retry.
      setError('Nu am putut verifica mesajul. Încercați din nou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl">Scam Shield</h1>
        <p className="text-ink/80">Verificăm mesajele și vă spunem ce să faceți.</p>
      </header>
      <PasteForm busy={busy} onSubmit={check} />
      {error !== null && <p role="alert" className="font-semibold text-scam">{error}</p>}
      {shown !== null && (
        <ResultView result={shown.result} messages={shown.messages} lang={lang} onLang={setLang} />
      )}
    </main>
  );
}
