import type { Hit, Result, Scenario, Weights } from '@ss/contracts';
import { clfHits, DEFAULT_THRESHOLDS, hasModel, type EmbedFn, type Thresholds } from './clf';
import { normalizeText } from './normalize';
import { runRules } from './rules';
import { impersonatedOrg } from './rules/impersonation';
import { decideType } from './scamType';
import { scoreThread } from './scoring';
import { buildWarning } from './warnings';

export * from './normalize';
export * from './scoring';
export * from './classifier';
export * from './clf';
export * from './embed';
export * from './warnings';
export { runRules } from './rules';
export { impersonatedOrg };

export interface AnalyzeOptions {
  /** Trained weights. Missing or the empty stub → rules only. */
  weights?: Weights;
  /** Per-flag cuts; defaults to ml/out/thresholds.json. */
  thresholds?: Thresholds;
  /** Injectable so tests never touch the network. */
  embedFn?: EmbedFn;
}

/**
 * Result plus engine-only extras. `impersonatedOrg` is NOT in contracts/types.ts (contracts are frozen; adding it is
 * a team decision), so it lives here: an AnalyzeResult is still assignable to Result anywhere a Result is expected.
 */
export type AnalyzeResult = Result & { impersonatedOrg: string | null };

/** Classifier hits, or none when there is no model or Ollama is down: a dead embedder must not break detection. */
async function modelHits(s: Scenario, opts: AnalyzeOptions): Promise<{ hits: Hit[]; ok: boolean }> {
  if (!hasModel(opts.weights)) return { hits: [], ok: true };
  try {
    return { hits: await clfHits(s, opts.weights, opts.thresholds ?? DEFAULT_THRESHOLDS, opts.embedFn), ok: true };
  } catch {
    return { hits: [], ok: false };
  }
}

// Rules + embedding classifier → scoreThread (each flag counted once) → decision list for scamType.
export async function analyze(s: Scenario, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const t0 = performance.now();
  const texts = s.messages.map((m) => normalizeText(m.text));
  const tNormalize = performance.now() - t0;

  const tRules = performance.now();
  const ruleHits = runRules(s);
  const rulesMs = performance.now() - tRules;

  const tClf = performance.now();
  const clf = await modelHits(s, opts);
  const clfMs = performance.now() - tClf;

  const hits = [...ruleHits, ...clf.hits];
  const { score, timeline, firstAlert, verdict } = scoreThread(hits, texts.length);
  const scamType = decideType(s, hits, verdict === 'SAFE');
  const org = impersonatedOrg(s, hits);
  const timingsMs: Record<string, number> = { normalize: tNormalize, rules: rulesMs, clf: clfMs };
  // 1 = the model was asked but the embedder failed, so this Result is rules only.
  if (!clf.ok) timingsMs.clfUnavailable = 1;
  timingsMs.total = performance.now() - t0;

  const partial = { id: s.id, verdict, scamType, score, firstAlert, timeline, hits, timingsMs };
  const threadText = s.messages.map((m) => m.text).join('\n');
  return { ...partial, warning: buildWarning(partial, { org, threadText }), impersonatedOrg: org };
}
