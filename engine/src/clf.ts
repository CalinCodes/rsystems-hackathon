import type { FlagCode, Hit, Scenario, Weights } from '@ss/contracts';
import { ALL_FLAGS } from '@ss/contracts';
import p90 from '../../ml/out/thresholds.json';
import { predict } from './classifier';
import { embed } from './embed';

/** Per-flag probability cut from ml/train.py. null = no cut was precise enough: rules only. */
export type Thresholds = Partial<Record<FlagCode, { threshold: number | null }>>;

/** Default cut set. The p80 set lives next to it in ml/out; eval --ablation compares both. */
export const DEFAULT_THRESHOLDS = p90 as Thresholds;

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

/** The stub weights carry no flags; treating them as "no model" keeps tests and fixtures offline. */
export const hasModel = (w: Weights | undefined): w is Weights => w !== undefined && Object.keys(w.flags).length > 0;

/**
 * One clf hit per (sender message, flag) whose probability reaches the flag's cut. Reader replies are
 * skipped: they never carry flags. Raw text is embedded because training rows keep diacritics and case.
 * Evidence stays empty: the model sees the whole message, so no word span can honestly be highlighted.
 */
export async function clfHits(s: Scenario, weights: Weights, cuts: Thresholds, embedFn: EmbedFn = embed): Promise<Hit[]> {
  const msgs = s.messages.filter((m) => m.from === 'sender' && m.text.trim() !== '');
  if (msgs.length === 0) return [];
  const vecs = await embedFn(msgs.map((m) => m.text));
  const hits: Hit[] = [];
  msgs.forEach((m, i) => {
    const vec = vecs[i];
    if (!vec) return;
    const probs = predict(vec, weights);
    for (const flag of ALL_FLAGS) {
      const cut = cuts[flag]?.threshold ?? null;
      if (cut !== null && probs[flag] >= cut) hits.push({ flag, msg: m.n, evidence: '', src: 'clf', p: probs[flag] });
    }
  });
  return hits;
}
