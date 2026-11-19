import { describe, expect, it } from 'vitest';
import type { Scenario, Weights } from '@ss/contracts';
import { clfHits, hasModel } from './clf';
import { analyze } from './index';

const thread = (msgs: [Scenario['messages'][number]['from'], string][]): Scenario => ({
  id: 'T',
  channel: 'chat',
  sender: { name: null, address: null, known_contact: false },
  messages: msgs.map(([from, text], i) => ({ n: i + 1, from, text })),
});

// 2-dim toy model: dimension 0 drives RF_URGENCY, dimension 1 drives RF_SECRECY.
const weights: Weights = {
  model: 'bge-m3',
  dim: 2,
  flags: { RF_URGENCY: { w: [10, 0], b: -5 }, RF_SECRECY: { w: [0, 10], b: -5 } },
  type: null,
};
const vecFor = (text: string): number[] => [text.includes('acum') ? 1 : 0, text.includes('secret') ? 1 : 0];
const fakeEmbed = async (texts: string[]): Promise<number[][]> => texts.map(vecFor);

describe('hasModel', () => {
  it('treats missing and stub weights as no model', () => {
    expect(hasModel(undefined)).toBe(false);
    expect(hasModel({ model: 'bge-m3', dim: 1024, flags: {}, type: null })).toBe(false);
    expect(hasModel(weights)).toBe(true);
  });
});

describe('clfHits', () => {
  it('fires at the cut, on the right message, with src clf and p', async () => {
    const s = thread([['sender', 'buna ziua'], ['reader', 'da'], ['sender', 'faceti acum']]);
    const hits = await clfHits(s, weights, { RF_URGENCY: { threshold: 0.9 } }, fakeEmbed);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ flag: 'RF_URGENCY', msg: 3, src: 'clf', evidence: '' });
    expect(hits[0]?.p).toBeGreaterThan(0.9);
  });

  it('skips reader messages and flags whose cut is null', async () => {
    const seen: string[] = [];
    const embedSpy = async (texts: string[]): Promise<number[][]> => {
      seen.push(...texts);
      return texts.map(vecFor);
    };
    const s = thread([['reader', 'acum secret'], ['sender', 'acum secret']]);
    const hits = await clfHits(s, weights, { RF_URGENCY: { threshold: null }, RF_SECRECY: { threshold: 0.5 } }, embedSpy);
    expect(seen).toEqual(['acum secret']);
    expect(hits.map((h) => [h.flag, h.msg])).toEqual([['RF_SECRECY', 2]]);
  });
});

describe('analyze with the classifier', () => {
  it('adds clf points to the rule score', async () => {
    const s = thread([['sender', 'buna ziua, e un secret']]);
    const rulesOnly = await analyze(s);
    const withClf = await analyze(s, { weights, thresholds: { RF_SECRECY: { threshold: 0.9 } }, embedFn: fakeEmbed });
    expect(withClf.hits.some((h) => h.src === 'clf' && h.flag === 'RF_SECRECY')).toBe(true);
    expect(withClf.score).toBeGreaterThanOrEqual(rulesOnly.score);
  });

  it('falls back to rules only when the embedder fails', async () => {
    const s = thread([['sender', 'buna ziua']]);
    const down = async (): Promise<number[][]> => {
      throw new Error('ollama down');
    };
    const r = await analyze(s, { weights, embedFn: down });
    const base = await analyze(s);
    expect([r.verdict, r.score, r.scamType]).toEqual([base.verdict, base.score, base.scamType]);
    expect(r.timingsMs.clfUnavailable).toBe(1);
  });

  it('is deterministic with the same model', async () => {
    const s = thread([['sender', 'faceti acum, e secret']]);
    const opts = { weights, thresholds: { RF_URGENCY: { threshold: 0.9 } }, embedFn: fakeEmbed };
    const a = await analyze(s, opts);
    const b = await analyze(s, opts);
    expect({ ...a, timingsMs: {} }).toEqual({ ...b, timingsMs: {} });
  });
});
