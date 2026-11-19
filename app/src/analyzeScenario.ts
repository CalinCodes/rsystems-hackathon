import type { Result, Scenario } from '@ss/contracts';
import { analyze } from '@ss/engine';
import { getWeights } from './weights';

/**
 * The ONLY place the app calls the engine. The check screen, the dashboard and the detail view all
 * go through here, so the same scenario always gives the same Result everywhere.
 */
export async function analyzeScenario(s: Scenario): Promise<Result> {
  return analyze(s, { weights: await getWeights() });
}
