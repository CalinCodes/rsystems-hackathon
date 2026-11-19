import { describe, expect, it } from 'vitest';
import type { Result } from '@ss/contracts';
import { bannerModel, shouldNotify } from './banner';
import { cachedEmbed, RETRY_AFTER_MS } from './embedCache';
import { toScenario } from './thread';

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

const known = toScenario('Mama', [{ outgoing: false, text: 'x' }]);
const unknown = toScenario('\u202a+40 721 555 000\u202c', [{ outgoing: false, text: 'x' }]);

describe('bannerModel', () => {
  it('shows nothing for a SAFE chat with a saved contact', () => {
    expect(bannerModel(result('SAFE'), known)).toBeNull();
  });
  it('shows a calm grey note for a SAFE chat with an unknown number', () => {
    const m = bannerModel(result('SAFE'), unknown);
    expect(m?.tone).toBe('info');
    expect(m?.body).toContain('număr necunoscut');
  });
  it('uses the engine warning, adds the unknown-number note, and says whether the local model ran', () => {
    const on = bannerModel(result('SCAM'), unknown);
    expect(on).toMatchObject({ tone: 'scam', body: 'Atenție, pare o țeapă! Text.', action: 'Nu răspundeți.' });
    expect(on?.note).toBe('Numărul nu este în agenda dumneavoastră.');
    expect(on?.footer).toContain('model AI local');
    const off = bannerModel(result('SUSPICIOUS', { clf: 1, clfUnavailable: 1 }), known);
    expect(off?.tone).toBe('suspicious');
    expect(off?.note).toBeNull();
    expect(off?.footer).not.toContain('model AI');
  });
});

describe('saved contact asking for data', () => {
  it('tells the reader to call that person, not a company', () => {
    const m = bannerModel({ ...result('SUSPICIOUS'), scamType: 'OTHER' }, known);
    expect(m?.action).toBe('Nu trimiteți nimic și sunați persoana la numărul pe care îl aveți deja salvat.');
  });
  it('keeps the engine action for a fake bank, even from a saved contact', () => {
    const m = bannerModel({ ...result('SCAM'), scamType: 'BANK_IMPERSONATION' }, known);
    expect(m?.action).toBe('Nu răspundeți.');
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
