import { ALL_FLAGS } from '@ss/contracts';
import { describe, expect, it } from 'vitest';
import { flagLabel } from './flags';

describe('flagLabel', () => {
  it('has a plain Romanian label for every flag, none showing the raw code', () => {
    for (const f of ALL_FLAGS) {
      const label = flagLabel(f);
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toContain('RF_');
    }
  });

  it('uses a different label for every flag', () => {
    const labels = ALL_FLAGS.map(flagLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
