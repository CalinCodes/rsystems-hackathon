import { describe, expect, it } from 'vitest';
import type { Result } from '@ss/contracts';
import { bannerModel, shouldNotify } from './banner';
import { cachedEmbed, RETRY_AFTER_MS } from './embedCache';

const result = (verdict: Result['verdict'], timingsMs: Record<string, number> = { clf: 1 }): Result => ({
  id: 'WhatsApp',
  verdict,
  scamType: verdict === 'SAFE' ? 'NONE' : 'OTHER',
  score: verdict === 'SCAM' ? 60 : verdict === 'SUSPICIOUS' ? 30 : 0,
  firstAlert: verdict === 'SAFE' ? null : 1,
  timeline: [0],
  hits: [],
  warning: { ro: 'Atenție, pare o țeapă! Text.', en: 'Warning.', action: 'Nu răspundeți.' },
  timingsMs,
});

describe('bannerModel', () => {
  it('shows nothing for SAFE', () => {
    expect(bannerModel(result('SAFE'))).toBeNull();
  });
  it('uses the engine warning and says whether the local model ran', () => {
    const on = bannerModel(result('SCAM'));
    expect(on).toMatchObject({ tone: 'scam', body: 'Atenție, pare o țeapă! Text.', action: 'Nu răspundeți.' });
    expect(on?.footer).toContain('model AI local');
    const off = bannerModel(result('SUSPICIOUS', { clf: 1, clfUnavailable: 1 }));
    expect(off?.tone).toBe('suspicious');
    expect(off?.footer).not.toContain('model AI');
  });
});

describe('shouldNotify', () => {
  it('rings once per chat and verdict, never for SAFE', () => {
    expect(shouldNotify(undefined, 'c1', result('SCAM'))).toBe(true);
    expect(shouldNotify('c1:SCAM', 'c1', result('SCAM'))).toBe(false);
    expect(shouldNotify('c1:SUSPICIOUS', 'c1', result('SCAM'))).toBe(true);
    expect(shouldNotify(undefined, 'c1', result('SAFE'))).toBe(false);
  });
});

describe('cachedEmbed', () => {
  it('embeds only new texts and returns vectors in input order', async () => {
    const calls: string[][] = [];
    const embed = cachedEmbed(async (t) => {
      calls.push(t);
      return t.map((x) => [x.length]);
    });
    expect(await embed(['a', 'bb'])).toEqual([[1], [2]]);
    expect(await embed(['bb', 'ccc', 'a'])).toEqual([[2], [3], [1]]);
    expect(calls).toEqual([['a', 'bb'], ['ccc']]);
  });
  it('stops calling a failing embedder for a while', async () => {
    let t = 0;
    let calls = 0;
    const embed = cachedEmbed(async () => {
      calls++;
      throw new Error('403');
    }, () => t);
    await expect(embed(['a'])).rejects.toThrow();
    await expect(embed(['a'])).rejects.toThrow();
    expect(calls).toBe(1);
    t = RETRY_AFTER_MS + 1;
    await expect(embed(['a'])).rejects.toThrow();
    expect(calls).toBe(2);
  });
});
