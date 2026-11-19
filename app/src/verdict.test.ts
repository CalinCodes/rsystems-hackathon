import { describe, expect, it } from 'vitest';
import { VERDICT_LOOK, scamTypeLabel } from './verdict';

describe('verdict presentation', () => {
  it('has a distinct icon and Romanian word for every verdict', () => {
    const words = Object.values(VERDICT_LOOK).map((v) => v.word);
    expect(new Set(words).size).toBe(words.length);
    expect(VERDICT_LOOK.SCAM.word).toBe('Pare o țeapă! Nu răspundeți');
  });

  it('has a short, distinct word for every verdict for tables and counters', () => {
    const shorts = Object.values(VERDICT_LOOK).map((v) => v.short);
    expect(new Set(shorts).size).toBe(shorts.length);
    for (const s of shorts) expect(s.length).toBeLessThanOrEqual(8);
  });

  it('translates known scam types and falls back to the raw code', () => {
    expect(scamTypeLabel('FAMILY_EMERGENCY')).toBe('Urgență în familie');
    expect(scamTypeLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE');
  });
});
