import type { Hit } from '@ss/contracts';
import { describe, expect, it } from 'vitest';
import { segmentMessage } from './highlight';

const hit = (msg: number, evidence: string, flag: Hit['flag'] = 'RF_URGENCY'): Hit => ({
  flag,
  msg,
  evidence,
  src: 'rule',
});

describe('segmentMessage', () => {
  it('returns one plain segment when there are no hits for the message', () => {
    expect(segmentMessage('Bună ziua', 1, [hit(2, 'ziua')])).toEqual([
      { text: 'Bună ziua', flag: null },
    ]);
  });

  it('splits around evidence and joins back to the original text', () => {
    const text = 'Plătiți urgent, vă rugăm.';
    const segs = segmentMessage(text, 1, [hit(1, 'urgent')]);
    expect(segs).toEqual([
      { text: 'Plătiți ', flag: null },
      { text: 'urgent', flag: 'RF_URGENCY' },
      { text: ', vă rugăm.', flag: null },
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
  });

  it('keeps the earlier piece when evidence overlaps', () => {
    const text = 'trimiteți 2.500 lei acum';
    const segs = segmentMessage(text, 1, [
      hit(1, 'trimiteți 2.500 lei', 'RF_PAYMENT_REQUEST'),
      hit(1, '2.500 lei', 'RF_URGENCY'),
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.flag !== null)).toHaveLength(1);
  });

  it('skips evidence it cannot find instead of throwing', () => {
    expect(segmentMessage('Salut', 1, [hit(1, 'nu există')])).toEqual([
      { text: 'Salut', flag: null },
    ]);
  });

  it('finds evidence even when the paste hides zero-width characters', () => {
    const segs = segmentMessage('ur\u200Bgent acum', 1, [hit(1, 'urgent')]);
    expect(segs[0]).toEqual({ text: 'urgent', flag: 'RF_URGENCY' });
  });
});
