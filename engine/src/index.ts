import type { Result, Scenario, Weights } from '@ss/contracts';
import { normalizeText } from './normalize';
import { scoreThread } from './scoring';
import { buildWarning } from './warnings';

export * from './normalize';
export * from './scoring';
export * from './classifier';
export * from './embed';
export * from './warnings';

export interface AnalyzeOptions {
  weights?: Weights;
}

// STUB: no detection yet — everything is SAFE/NONE with a correctly-shaped timeline.
export async function analyze(s: Scenario, _opts: AnalyzeOptions = {}): Promise<Result> {
  const t0 = performance.now();
  const texts = s.messages.map((m) => normalizeText(m.text));
  const tNormalize = performance.now() - t0;

  const { score, timeline, firstAlert, verdict } = scoreThread([], texts.length);
  const partial = {
    id: s.id,
    verdict,
    scamType: 'NONE' as const,
    score,
    firstAlert,
    timeline,
    hits: [],
    timingsMs: { normalize: tNormalize, total: performance.now() - t0 },
  };
  return { ...partial, warning: buildWarning(partial) };
}
