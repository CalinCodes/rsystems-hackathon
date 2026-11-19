import { useRef, type ChangeEvent } from 'react';
import type { Scenario } from '@ss/contracts';
import { parseScenarioJson } from './scenarioFile';

interface OpenFileButtonProps {
  disabled: boolean;
  onScenario: (s: Scenario) => void;
  onInvalid: () => void;
}

/** Opens one scenario .json from disk. The file is read in memory and never uploaded or kept. */
export function OpenFileButton({ disabled, onScenario, onInvalid }: OpenFileButtonProps) {
  const input = useRef<HTMLInputElement>(null);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice still fires a change.
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseScenarioJson(await file.text());
      if (parsed.ok) onScenario(parsed.scenario);
      else onInvalid();
    } catch {
      onInvalid();
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="min-h-14 rounded-card border-2 border-ink/30 bg-surface px-5 font-semibold disabled:opacity-50"
      >
        Deschide fișier
      </button>
    </>
  );
}
