import type { Result, Scenario, Weights } from '@ss/contracts';
import { normalizeText } from './normalize';
import { runRules } from './rules';
import { impersonatedOrg } from './rules/impersonation';
import { decideType } from './scamType';
import { scoreThread } from './scoring';
import { buildWarning } from './warnings';

export * from './normalize';
export * from './scoring';
export * from './classifier';
export * from './embed';
export * from './warnings';
export { runRules } from './rules';
export { impersonatedOrg };

export interface AnalyzeOptions {
  weights?: Weights;
}

/**
 * Result plus engine-only extras. `impersonatedOrg` is NOT in contracts/types.ts (contracts are frozen; adding it is
 * a team decision), so it lives here: an AnalyzeResult is still assignable to Result anywhere a Result is expected.
 */
export type AnalyzeResult = Result & { impersonatedOrg: string | null };

// Rules → scoreThread → decision list for scamType. The embedding classifier is not wired in yet.
export async function analyze(s: Scenario, _opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const t0 = performance.now();
  const texts = s.messages.map((m) => normalizeText(m.text));
  const tNormalize = performance.now() - t0;

  const tRules = performance.now();
  const hits = runRules(s);
  const rulesMs = performance.now() - tRules;
  const { score, timeline, firstAlert, verdict } = scoreThread(hits, texts.length);
  const partial = {
    id: s.id,
    verdict,
    scamType: decideType(s, hits, verdict === 'SAFE'),
    score,
    firstAlert,
    timeline,
    hits,
    timingsMs: { normalize: tNormalize, rules: rulesMs, total: performance.now() - t0 },
  };
  return { ...partial, warning: buildWarning(partial), impersonatedOrg: impersonatedOrg(s, hits) };
}
