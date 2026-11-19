import type { FlagCode, Weights } from '@ss/contracts';
import { ALL_FLAGS } from '@ss/contracts';

export function loadWeights(json: unknown): Weights {
  const w = json as Partial<Weights> | null;
  if (!w || typeof w.model !== 'string' || typeof w.dim !== 'number' || typeof w.flags !== 'object' || w.flags === null) {
    throw new Error('Invalid weights JSON');
  }
  return { model: w.model, dim: w.dim, flags: w.flags, type: w.type ?? null };
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/** A flag with no trained weights scores 0 so the engine degrades to rules only. */
export function predict(emb: number[], weights: Weights): Record<FlagCode, number> {
  const out = {} as Record<FlagCode, number>;
  for (const flag of ALL_FLAGS) {
    const m = weights.flags[flag];
    if (!m) {
      out[flag] = 0;
      continue;
    }
    let z = m.b;
    for (let i = 0; i < m.w.length; i++) z += (m.w[i] ?? 0) * (emb[i] ?? 0);
    out[flag] = sigmoid(z);
  }
  return out;
}
