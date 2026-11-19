/** Risk after the first `shown` messages: 0 before any message, the last value once all are shown. */
export function scoreAt(timeline: number[], shown: number): number {
  if (shown <= 0 || timeline.length === 0) return 0;
  return timeline[Math.min(shown, timeline.length) - 1] ?? 0;
}

/**
 * Calls `onStep` with 0, then 1, 2 … total, one every `delayMs`. Returns a function that stops it.
 * Kept free of React so the timing can be tested with fake timers.
 */
export function startReplay(total: number, onStep: (shown: number) => void, delayMs: number): () => void {
  let shown = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onStep(0);
  const next = () => {
    timer = setTimeout(() => {
      shown += 1;
      onStep(shown);
      if (shown < total) next();
    }, delayMs);
  };
  if (total > 0) next();
  return () => clearTimeout(timer);
}
