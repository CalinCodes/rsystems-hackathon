import { useCallback, useState } from 'react';
import type { Result, Scenario } from '@ss/contracts';
import { analyzeScenario } from './analyzeScenario';

/** Shared by every screen. `busy` is true while any analysis is running. State is memory-only. */
export function useAnalyze(): { run: (s: Scenario) => Promise<Result>; busy: boolean } {
  const [pending, setPending] = useState(0);
  const run = useCallback(async (s: Scenario) => {
    setPending((p) => p + 1);
    try {
      return await analyzeScenario(s);
    } finally {
      setPending((p) => p - 1);
    }
  }, []);
  return { run, busy: pending > 0 };
}
