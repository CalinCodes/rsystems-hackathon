import { describe, expect, it } from 'vitest';
import type { Scenario } from '@ss/contracts';
import { analyze } from './index';

// Regression guard for quadratic regex backtracking. Each input is a long run that almost matches a pattern;
// before the start-of-run lookbehinds and the bounded amount these took seconds to minutes at this size.
// Limit is ~100x the normal cost, so it only trips on a real algorithmic regression, not a slow machine.
const N = 100_000;
const LIMIT_MS = 2000;

const scenario = (text: string): Scenario => ({
  id: 'P',
  channel: 'email',
  sender: { name: null, address: null, known_contact: false },
  messages: [{ n: 1, from: 'sender', text }],
});

const CASES: Record<string, string> = {
  'letters, no dot': 'a'.repeat(N),
  'digits, no currency': '1'.repeat(N),
  'digits and spaces': '1 '.repeat(N / 2),
  'digits and dots': '1.'.repeat(N / 2),
  'digits and commas': '1,'.repeat(N / 2),
  'dots only': '.'.repeat(N),
  'zero-width characters': 'a​'.repeat(N / 2),
  'email-like run': 'a-b'.repeat(N / 3),
  'dotted labels': 'ro.'.repeat(N / 3),
  'repeated request words': 'trimite cod '.repeat(N / 12),
  'repeated denials': 'nu il comunicati codul '.repeat(N / 23),
  'digits and padding then no currency': ('1' + ' '.repeat(50)).repeat(N / 51),
  'many addresses': 'a@b.ro/ '.repeat(N / 8),
  'at signs': '@'.repeat(N),
  'address chars, many at': 'a@'.repeat(N / 2) + 'b',
  'payment verbs and digits': 'platiti 1 '.repeat(N / 10),
};

describe('no quadratic blow-ups on long inputs', () => {
  it.each(Object.entries(CASES))('%s', async (_name, text) => {
    const t0 = performance.now();
    await analyze(scenario(text));
    expect(performance.now() - t0).toBeLessThan(LIMIT_MS);
  });
});
