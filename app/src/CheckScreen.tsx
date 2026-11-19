import { useCallback, useState } from 'react';
import type { Result, Scenario } from '@ss/contracts';
import { PasteForm } from './PasteForm';
import { ResultCard } from './ResultCard';
import { Thinking } from './Thinking';
import type { Lang } from './lang';
import { MIN_THINK_MS, pause } from './motionConfig';
import { useAnalyze } from './useAnalyze';

interface CheckScreenProps {
  lang: Lang;
  onLang: (lang: Lang) => void;
}

interface Shown {
  result: Result;
  messages: Scenario['messages'];
}

// Fixed sentences: an error must never echo anything from the message.
const CHECK_FAILED = 'Nu am putut verifica mesajul. Încercați din nou.';
const BAD_FILE = 'Fișierul nu pare un mesaj pe care îl pot citi. Alegeți un fișier .json cu un mesaj.';

export function CheckScreen({ lang, onLang }: CheckScreenProps) {
  const { run, busy } = useAnalyze();
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(
    async (scenario: Scenario) => {
      if (scenario.messages.length === 0) return;
      setError(null);
      setShown(null);
      try {
        const [result] = await Promise.all([run(scenario), pause(MIN_THINK_MS)]);
        setShown({ result, messages: scenario.messages });
      } catch {
        setError(CHECK_FAILED);
      }
    },
    [run],
  );

  return (
    <div className="flex flex-col gap-10">
      <PasteForm busy={busy} onCheck={check} onInvalidFile={() => setError(BAD_FILE)} />
      {error !== null && (
        <p role="alert" className="text-xl font-semibold text-scam">
          {error}
        </p>
      )}
      {busy && <Thinking />}
      {!busy && shown !== null && (
        <ResultCard result={shown.result} messages={shown.messages} lang={lang} onLang={onLang} />
      )}
    </div>
  );
}
