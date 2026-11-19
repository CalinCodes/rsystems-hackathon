import { expect, it } from 'vitest';
import { loadWeights, predict } from './classifier';

it('returns 0 for flags without weights', () => {
  const w = loadWeights({ model: 'bge-m3', dim: 2, flags: {}, type: null });
  expect(predict([1, 2], w).RF_URGENCY).toBe(0);
});

it('applies sigmoid(dot(w,emb)+b)', () => {
  const w = loadWeights({ model: 'bge-m3', dim: 2, flags: { RF_URGENCY: { w: [1, 1], b: 0 } }, type: null });
  expect(predict([0, 0], w).RF_URGENCY).toBeCloseTo(0.5);
  expect(predict([10, 10], w).RF_URGENCY).toBeGreaterThan(0.99);
});

it('rejects malformed weights', () => {
  expect(() => loadWeights({})).toThrow();
});
