import { describe, expect, it } from 'vitest';
import { findSensitive, guardHit, guardText, isCnp, isLuhn } from './guard';

// Test numbers only: a public Luhn test card and a CNP built to pass the control digit, not a real person's.
const CARD = '4111 1111 1111 1111';
const CNP = '1800101420010';

describe('isLuhn', () => {
  it('accepts a valid card number and rejects one wrong digit', () => {
    expect(isLuhn('4111111111111111')).toBe(true);
    expect(isLuhn('4111111111111112')).toBe(false);
  });
  it('rejects runs that are too short or too long', () => {
    expect(isLuhn('42')).toBe(false);
    expect(isLuhn('4'.repeat(20))).toBe(false);
  });
});

describe('isCnp', () => {
  it('accepts a CNP with the right control digit', () => {
    expect(isCnp(CNP)).toBe(true);
  });
  it('rejects a wrong control digit, month or day', () => {
    expect(isCnp('1800101420011')).toBe(false);
    expect(isCnp('1801301420010')).toBe(false);
    expect(isCnp('1800100420010')).toBe(false);
  });
});

describe('findSensitive', () => {
  it('finds an SMS code, also when typed in groups', () => {
    expect(findSensitive('codul e 482913')).toBe('code');
    expect(findSensitive('482 913')).toBe('code');
  });
  it('finds a card number with spaces or dashes', () => {
    expect(findSensitive(`cardul meu: ${CARD}`)).toBe('card');
    expect(findSensitive('4111-1111-1111-1111')).toBe('card');
  });
  it('finds a CNP before calling it a card', () => {
    expect(findSensitive(`CNP ${CNP}`)).toBe('cnp');
  });
  it('finds remote access handed over with an app id', () => {
    expect(findSensitive('am instalat AnyDesk, id 123 456 789')).toBe('remote');
  });
  it('ignores amounts, hours, phone numbers and short numbers', () => {
    expect(findSensitive('ți-am trimis 1850 lei')).toBeNull();
    expect(findSensitive('costă 2500 de lei')).toBeNull();
    expect(findSensitive('vin la 12:30')).toBeNull();
    expect(findSensitive('sună-mă la 0722 123 456')).toBeNull();
    expect(findSensitive('am 72 de ani')).toBeNull();
  });
  it('does not crash on empty, emoji-only or no-break-space text', () => {
    expect(findSensitive('')).toBeNull();
    expect(findSensitive('😀😀')).toBeNull();
    expect(findSensitive('482\u00a0913')).toBe('code');
  });
  it('mentioning a remote app without a number is not a hand-over', () => {
    expect(findSensitive('ce este AnyDesk?')).toBeNull();
  });
  it('is the same answer every time', () => {
    const d = `codul 482913 și cardul ${CARD}`;
    expect(findSensitive(d)).toBe(findSensitive(d));
  });
});

describe('guardHit', () => {
  it('never stops a send in a SAFE chat', () => {
    expect(guardHit('482913', 'SAFE', '')).toBeNull();
  });
  it('stops a code in a SUSPICIOUS or SCAM chat', () => {
    expect(guardHit('482913', 'SCAM', '')).toBe('code');
    expect(guardHit('482913', 'SUSPICIOUS', '')).toBe('code');
  });
  it('lets the exact draft through after "send anyway"', () => {
    expect(guardHit('482913', 'SCAM', '482913')).toBeNull();
    expect(guardHit('482914', 'SCAM', '482913')).toBe('code');
  });
});

describe('guardText', () => {
  it('names what is at risk, keeps the official action and repeats no number', () => {
    const t = guardText('card', 'Sunați la numărul de pe spatele cardului.');
    expect(t).toContain('numărul cardului');
    expect(t.endsWith('Sunați la numărul de pe spatele cardului.')).toBe(true);
    expect(t).not.toMatch(/\d/);
    expect(t.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(3);
  });
});
