import type { FlagCode, Hit, Verdict } from '@ss/contracts';
import { ALERT_THRESHOLD, FLAG_POINTS, SCORE_CAP, verdictFor } from '@ss/contracts';

export interface ThreadScore {
  score: number;
  timeline: number[];
  firstAlert: number | null;
  verdict: Verdict;
}

/**
 * Each flag is counted once, at the first message where it appears: repeating
 * "send money" five times must not out-score a thread with five different red flags.
 */
export function scoreThread(hits: Hit[], messageCount: number): ThreadScore {
  const firstSeen = new Map<FlagCode, number>();
  for (const h of hits) {
    const prev = firstSeen.get(h.flag);
    if (prev === undefined || h.msg < prev) firstSeen.set(h.flag, h.msg);
  }

  const timeline: number[] = [];
  for (let k = 1; k <= messageCount; k++) {
    let sum = 0;
    for (const [flag, msg] of firstSeen) if (msg <= k) sum += FLAG_POINTS[flag];
    timeline.push(Math.min(sum, SCORE_CAP));
  }

  const idx = timeline.findIndex((s) => s >= ALERT_THRESHOLD);
  const score = timeline[timeline.length - 1] ?? 0;
  return { score, timeline, firstAlert: idx === -1 ? null : idx + 1, verdict: verdictFor(score) };
}
