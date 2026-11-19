import { describe, expect, it } from 'vitest';
import type { Hit } from '@ss/contracts';
import { verdictFor } from '@ss/contracts';
import { scoreThread } from './scoring';

const hit = (flag: Hit['flag'], msg: number): Hit => ({ flag, msg, evidence: '', src: 'rule' });

describe('scoreThread', () => {
  it('is cumulative across messages', () => {
    const r = scoreThread([hit('RF_NEW_NUMBER', 1), hit('RF_PAYMENT_REQUEST', 4)], 6);
    expect(r.timeline).toEqual([20, 20, 20, 45, 45, 45]);
    expect(r.score).toBe(45);
    expect(r.verdict).toBe('SUSPICIOUS');
  });

  it('counts a repeated flag once', () => {
    const r = scoreThread([hit('RF_URGENCY', 1), hit('RF_URGENCY', 2), hit('RF_URGENCY', 3)], 3);
    expect(r.timeline).toEqual([15, 15, 15]);
  });

  it('caps at 100', () => {
    const r = scoreThread(
      [hit('RF_CODE_REQUEST', 1), hit('RF_REMOTE_ACCESS', 1), hit('RF_DATA_REQUEST', 1), hit('RF_PAYMENT_REQUEST', 1)],
      2,
    );
    expect(r.timeline).toEqual([100, 100]);
    expect(r.verdict).toBe('SCAM');
  });

  it('finds the first message reaching the alert threshold', () => {
    const r = scoreThread([hit('RF_NEW_NUMBER', 1), hit('RF_PAYMENT_REQUEST', 4)], 6);
    expect(r.firstAlert).toBe(4);
    expect(scoreThread([hit('RF_URGENCY', 1)], 3).firstAlert).toBeNull();
  });

  it('handles no hits and empty threads', () => {
    expect(scoreThread([], 2)).toEqual({ score: 0, timeline: [0, 0], firstAlert: null, verdict: 'SAFE' });
    expect(scoreThread([], 0).score).toBe(0);
  });

  it('uses the right verdict bands', () => {
    expect(verdictFor(0)).toBe('SAFE');
    expect(verdictFor(24)).toBe('SAFE');
    expect(verdictFor(25)).toBe('SUSPICIOUS');
    expect(verdictFor(49)).toBe('SUSPICIOUS');
    expect(verdictFor(50)).toBe('SCAM');
    expect(verdictFor(100)).toBe('SCAM');
  });
});
