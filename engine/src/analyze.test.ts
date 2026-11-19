import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Scenario } from '@ss/contracts';
import { analyze } from './index';

const fixture = (id: string): Scenario =>
  JSON.parse(readFileSync(new URL(`../../contracts/fixtures/${id}.json`, import.meta.url), 'utf8')) as Scenario;

describe('analyze on the invented fixtures', () => {
  it('F01: new-number family thread → SCAM, alert at message 4', async () => {
    const r = await analyze(fixture('F01'));
    expect([r.verdict, r.scamType, r.score, r.firstAlert]).toEqual(['SCAM', 'FAMILY_EMERGENCY', 80, 4]);
    expect(r.timeline).toEqual([20, 20, 20, 45, 60, 80]);
  });
  it('F02: prize SMS → SUSPICIOUS prize/lottery', async () => {
    const r = await analyze(fixture('F02'));
    expect([r.verdict, r.scamType, r.score]).toEqual(['SUSPICIOUS', 'PRIZE_LOTTERY', 35]);
  });
  it('F03: genuine bank OTP → SAFE', async () => {
    const r = await analyze(fixture('F03'));
    expect([r.verdict, r.scamType, r.score]).toEqual(['SAFE', 'NONE', 0]);
  });
});
