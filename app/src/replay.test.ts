import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scoreAt, startReplay } from './replay';

describe('scoreAt', () => {
  const timeline = [20, 45, 80];

  it('is 0 before the first message', () => {
    expect(scoreAt(timeline, 0)).toBe(0);
  });

  it('follows the timeline message by message', () => {
    expect([1, 2, 3].map((n) => scoreAt(timeline, n))).toEqual([20, 45, 80]);
  });

  it('stays on the last value past the end and is 0 for an empty timeline', () => {
    expect(scoreAt(timeline, 9)).toBe(80);
    expect(scoreAt([], 3)).toBe(0);
  });
});

describe('startReplay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('steps 0, 1, 2, 3 and then stops by itself', () => {
    const steps: number[] = [];
    startReplay(3, (n) => steps.push(n), 1000);
    expect(steps).toEqual([0]);
    vi.advanceTimersByTime(3000);
    expect(steps).toEqual([0, 1, 2, 3]);
    vi.advanceTimersByTime(10_000);
    expect(steps).toEqual([0, 1, 2, 3]);
  });

  it('waits the full delay between steps', () => {
    const steps: number[] = [];
    startReplay(2, (n) => steps.push(n), 1000);
    vi.advanceTimersByTime(999);
    expect(steps).toEqual([0]);
    vi.advanceTimersByTime(1);
    expect(steps).toEqual([0, 1]);
  });

  it('can be cancelled half way', () => {
    const steps: number[] = [];
    const stop = startReplay(5, (n) => steps.push(n), 1000);
    vi.advanceTimersByTime(2000);
    stop();
    vi.advanceTimersByTime(10_000);
    expect(steps).toEqual([0, 1, 2]);
  });

  it('only resets to 0 for an empty thread', () => {
    const steps: number[] = [];
    startReplay(0, (n) => steps.push(n), 1000);
    vi.advanceTimersByTime(5000);
    expect(steps).toEqual([0]);
  });
});
