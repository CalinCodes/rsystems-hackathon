import { describe, expect, it } from 'vitest';
import type { FlagCode, Scenario } from '@ss/contracts';
import { runRules } from './index';

const flags = (text: string, sender: Partial<Scenario['sender']> = {}): FlagCode[] => [
  ...new Set(
    runRules({
      id: 'T',
      channel: 'sms',
      sender: { name: null, address: null, known_contact: false, ...sender },
      messages: [{ n: 1, from: 'sender', text }],
    }).map((h) => h.flag),
  ),
];

describe('soft rules', () => {
  it('urgency', () => {
    expect(flags('Răspundeți în 24 de ore')).toContain('RF_URGENCY');
    expect(flags('Te rog repede')).toContain('RF_URGENCY');
  });
  it('secrecy fires on hiding it from people, not on bank code warnings', () => {
    expect(flags('Nu spune nimănui, nici lui tata')).toContain('RF_SECRECY');
    expect(flags('Nu îl comunicați nimănui.')).not.toContain('RF_SECRECY');
    expect(flags('Nu spuneți nimănui codul primit.')).not.toContain('RF_SECRECY');
  });
  it('too good to be true', () => {
    expect(flags('Felicitări! Ați câștigat un voucher')).toContain('RF_TOO_GOOD');
  });
  it('threat', () => {
    expect(flags('Cardul dvs. a fost blocat')).toContain('RF_THREAT');
    expect(flags('Veți primi o amendă')).toContain('RF_THREAT');
  });
  it('impersonation needs a self-introduction, not just a sender label', () => {
    expect(flags('Sunt Ion de la banca dumneavoastră')).toContain('RF_IMPERSONATION');
    expect(flags('Sunt la banca acum')).not.toContain('RF_IMPERSONATION');
    expect(flags('Banca Dunărea: Codul este 483920.')).not.toContain('RF_IMPERSONATION');
  });
  it('impersonation also fires when a named organisation has a foreign contact', () => {
    expect(flags('Banca Dunărea: intrați pe bancadunarea-x.example')).toContain('RF_IMPERSONATION');
  });
  it('emotional pressure and channel switch', () => {
    expect(flags('Ajută-mă, te implor')).toContain('RF_EMOTIONAL_PRESSURE');
    expect(flags('Scrie-mi pe WhatsApp')).toContain('RF_CHANNEL_SWITCH');
  });
});
