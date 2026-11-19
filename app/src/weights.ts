import type { Weights } from '@ss/contracts';
import stub from '@ss/contracts/weights.stub.json';
import { loadWeights } from '@ss/engine';

// WHY a glob: ml/out/weights.json is produced by ml/train.py and may not exist yet. A plain import would
// break the build; a glob simply finds nothing. It stays lazy (the file is ~560 KB) so the first screen
// does not wait for it.
const trained = import.meta.glob<unknown>('../../ml/out/weights.json', { import: 'default' });

let cached: Promise<Weights> | null = null;

async function readWeights(): Promise<Weights> {
  const load = Object.values(trained)[0];
  if (load) {
    try {
      return loadWeights(await load());
    } catch {
      // A broken file must not take the app down: fall back to rules only, like a missing file.
    }
  }
  return loadWeights(stub);
}

/** Trained weights if present and valid, else the empty stub (the engine then scores by rules alone). */
export function getWeights(): Promise<Weights> {
  cached ??= readWeights();
  return cached;
}
