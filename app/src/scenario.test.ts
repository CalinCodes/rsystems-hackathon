import { describe, expect, it } from 'vitest';
import { buildScenario } from './scenario';

const base = { channel: 'sms', knownContact: false } as const;

describe('buildScenario', () => {
  it('splits sender messages on blank lines and numbers them from 1', () => {
    const s = buildScenario({ ...base, text: 'Primul\n\n  Al doilea  \n\n\nAl treilea' });
    expect(s.messages.map((m) => [m.n, m.from, m.text])).toEqual([
      [1, 'sender', 'Primul'],
      [2, 'sender', 'Al doilea'],
      [3, 'sender', 'Al treilea'],
    ]);
  });

  it('keeps one pasted message as one message, even with line breaks', () => {
    const s = buildScenario({ ...base, text: 'Rând unu\nRând doi' });
    expect(s.messages).toEqual([{ n: 1, from: 'sender', text: 'Rând unu\nRând doi' }]);
  });

  it('turns each "Eu:" line into a reader message without needing blank lines', () => {
    const s = buildScenario({ ...base, text: 'Bună\nEu: Cine sunteți?\nSunt Andrei\nEu: Ce doriți?' });
    expect(s.messages.map((m) => [m.n, m.from, m.text])).toEqual([
      [1, 'sender', 'Bună'],
      [2, 'reader', 'Cine sunteți?'],
      [3, 'sender', 'Sunt Andrei'],
      [4, 'reader', 'Ce doriți?'],
    ]);
  });

  it('drops an empty "Eu:" line, still ends the sender message there, and handles Windows line endings', () => {
    const s = buildScenario({ ...base, text: 'Salut\r\nEu:\r\nLa revedere' });
    expect(s.messages.map((m) => [m.from, m.text])).toEqual([
      ['sender', 'Salut'],
      ['sender', 'La revedere'],
    ]);
  });

  it('is deterministic and carries the known-contact choice', () => {
    const input = { text: 'Salut', channel: 'whatsapp', knownContact: true } as const;
    expect(buildScenario(input)).toEqual(buildScenario(input));
    expect(buildScenario(input).sender.known_contact).toBe(true);
  });

  it('gives no messages for blank input', () => {
    expect(buildScenario({ ...base, text: '  \n\n ' }).messages).toEqual([]);
  });
});
