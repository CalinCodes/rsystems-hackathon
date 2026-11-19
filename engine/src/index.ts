import type { Result, Scenario, Weights } from '@ss/contracts';
import { normalizeText } from './normalize';
import { runRules } from './rules';
import { decideType } from './scamType';
import { scoreThread } from './scoring';
import { buildWarning } from './warnings';

export * from './normalize';
export * from './scoring';
export * from './classifier';
export * from './embed';
export * from './warnings';
export { runRules } from './rules';

export interface AnalyzeOptions {
  weights?: Weights;
}

// Rules → scoreThread → decision list for scamType. The embedding classifier is not wired in yet.
export async function analyze(s: Scenario, _opts: AnalyzeOptions = {}): Promise<Result> {
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
  return { ...partial, warning: buildWarning(partial) };
}
