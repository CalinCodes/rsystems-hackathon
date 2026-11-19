import { analyze } from '@ss/engine';
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { buildScenario } from './scenario';

// WHY: the examples are what a visitor clicks first in a demo. If an engine change flips one,
// this fails here instead of on stage.
describe('example buttons', () => {
  const verdicts = async () =>
    Promise.all(EXAMPLES.map(async (e) => (await analyze(buildScenario(e.input))).verdict));

  it('warn on the two scam examples and stay quiet on the genuine code message', async () => {
    const [bank, family, code] = await verdicts();
    expect(bank).not.toBe('SAFE');
    expect(family).not.toBe('SAFE');
    expect(code).toBe('SAFE');
  });

  it('gives the same verdicts on a second run', async () => {
    expect(await verdicts()).toEqual(await verdicts());
  });
});
