import { describe, expect, it } from 'vitest';
import { analyzeScenario } from './analyzeScenario';
import { buildScenario } from './scenario';
import { getWeights } from './weights';

const check = (text: string) => analyzeScenario(buildScenario({ text, channel: 'sms', knownContact: false }));

describe('getWeights', () => {
  it('loads a valid weights object (trained file, or the stub when it is missing)', async () => {
    const w = await getWeights();
    expect(w.model).toBe('bge-m3');
    expect(typeof w.flags).toBe('object');
  });
});

describe('analyzeScenario never crashes on awkward input', () => {
  const cases: [string, string][] = [
    ['emoji only', '😀🎉🙏❤️😀🎉🙏❤️'],
    ['20 000 characters', 'Bună ziua, vă scriu despre colet. '.repeat(600)],
    ['no diacritics', 'Cardul dvs. a fost blocat. Accesati in 2 ore: bancadunarea-securizat.example'],
    ['a single character', 'a'],
    ['only punctuation', '?!?! ... ,,, ;;;'],
    ['zero-width characters inside words', 'ur\u200Bgent tran\u200Bsferă acum'],
  ];

  it.each(cases)('%s gives a complete Result', async (_name, text) => {
    const r = await check(text);
    expect(['SAFE', 'SUSPICIOUS', 'SCAM']).toContain(r.verdict);
    expect(r.timeline.length).toBeGreaterThan(0);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it('flags the same awkward text identically on a second run', async () => {
    const text = 'Cardul dvs. a fost blocat. Accesati in 2 ore: bancadunarea-securizat.example';
    const strip = (r: Awaited<ReturnType<typeof check>>) => ({ ...r, timingsMs: {} });
    expect(strip(await check(text))).toEqual(strip(await check(text)));
  });
});
