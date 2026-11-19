import { describe, expect, it } from 'vitest';
import { buildScenario } from './scenario';

const base = { channel: 'sms', knownContact: false } as const;

describe('buildScenario', () => {
  it('splits messages on blank lines and numbers them from 1', () => {
    const s = buildScenario({ ...base, text: 'Primul\n\n  Al doilea  \n\n\nAl treilea' });
    expect(s.messages.map((m) => [m.n, m.text])).toEqual([
      [1, 'Primul'],
      [2, 'Al doilea'],
      [3, 'Al treilea'],
    ]);
  });

  it('keeps single line breaks inside one message', () => {
    const s = buildScenario({ ...base, text: 'Rând unu\nRând doi' });
    expect(s.messages).toHaveLength(1);
  });

  it('marks "Eu:" paragraphs as the reader and drops the prefix', () => {
    const s = buildScenario({ ...base, text: 'Bună\n\nEu: Cine sunteți?' });
    expect(s.messages[1]).toEqual({ n: 2, from: 'reader', text: 'Cine sunteți?' });
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
