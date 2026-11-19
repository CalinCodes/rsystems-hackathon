import { describe, expect, it } from 'vitest';
import { analyze } from '@ss/engine';
import { MAX_MESSAGES, isPhoneTitle, threadKey, toScenario, type RawMessage } from './thread';

const inn = (text: string): RawMessage => ({ outgoing: false, text });
const out = (text: string): RawMessage => ({ outgoing: true, text });

describe('isPhoneTitle', () => {
  it('tells a number from a saved contact name', () => {
    expect(isPhoneTitle('+40 721 555 000')).toBe(true);
    expect(isPhoneTitle('Mama')).toBe(false);
    expect(isPhoneTitle('112')).toBe(false);
  });
  it('sees through the invisible direction marks and no-break spaces WhatsApp Web adds around numbers', () => {
    expect(isPhoneTitle('\u202a+40\u00a0721\u00a0555\u00a0000\u202c')).toBe(true);
    expect(isPhoneTitle('\u2066+40 721 555 000\u2069')).toBe(true);
    expect(toScenario('\u202a+40 721 555 000\u202c', [inn('x')]).sender).toEqual({
      name: null,
      address: '+40 721 555 000',
      known_contact: false,
    });
  });
});

describe('toScenario', () => {
  it('maps incoming to sender, own bubbles to reader, numbered from 1', () => {
    const s = toScenario('Ana', [inn('Bună!'), out('Salut'), inn('Ce faci?')]);
    expect(s.messages.map((m) => [m.n, m.from])).toEqual([[1, 'sender'], [2, 'reader'], [3, 'sender']]);
    expect(s.channel).toBe('whatsapp');
  });
  it('treats a phone-number title as an unknown sender, a name as a saved contact', () => {
    expect(toScenario('+40 721 555 000', [inn('x')]).sender).toEqual({ name: null, address: '+40 721 555 000', known_contact: false });
    expect(toScenario('Mama', [inn('x')]).sender).toEqual({ name: 'Mama', address: null, known_contact: true });
  });
  it('keeps only the latest messages and drops empty ones', () => {
    const many = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => inn(`m${i}`));
    const s = toScenario('Ana', [...many, inn('   ')]);
    expect(s.messages).toHaveLength(MAX_MESSAGES);
    expect(s.messages.at(-1)?.text).toBe(`m${MAX_MESSAGES + 4}`);
  });
  it('feeds the engine: an unknown number asking for an SMS code is flagged', async () => {
    const s = toScenario('+40 721 555 000', [inn('Salut!'), out('Cine e?'), inn('Trimite-mi te rog codul primit prin SMS, e urgent.')]);
    const r = await analyze(s);
    expect(r.verdict).not.toBe('SAFE');
    expect(r.firstAlert).toBe(3);
  });
});

describe('threadKey', () => {
  it('is stable and changes when a message is added', () => {
    const a = threadKey('Ana', [inn('x')]);
    expect(threadKey('Ana', [inn('x')])).toBe(a);
    expect(threadKey('Ana', [inn('x'), inn('y')])).not.toBe(a);
    expect(a).not.toContain('x');
  });
});
