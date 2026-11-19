import { describe, expect, it } from 'vitest';
import type { FlagCode, Scenario } from '@ss/contracts';
import { analyze } from '../index';
import { runRules } from './index';

// Gaps found by a blind stress set (scenarios written by an author who never saw these rules). Every sentence below
// is re-worded for the test, so the rules are checked on phrasing they were not fitted to word for word.

const one = (text: string, sender: Partial<Scenario['sender']> = {}): Scenario => ({
  id: 'T',
  channel: 'sms',
  sender: { name: null, address: '+40 7xx xxx 100', known_contact: false, ...sender },
  messages: [{ n: 1, from: 'sender', text }],
});
const flags = (text: string, sender?: Partial<Scenario['sender']>): FlagCode[] => [...new Set(runRules(one(text, sender)).map((h) => h.flag))];

describe('payment: needs, fees, safe-account moves', () => {
  it.each([
    'Îmi trebuie 900 de euro pentru taxe, altfel nu pot pleca.',
    'Comisionul de 150 lei este plătibil în 24 de ore.',
    'Pentru activare se cere o garanție de 100 lei.',
    'Mutați economiile într-un cont sigur până se termină ancheta.',
  ])('fires on "%s"', (t) => expect(flags(t)).toContain('RF_PAYMENT_REQUEST'));
  it('a reassurance is not a request: "nu trebuie să plătiți nimic"', () => {
    expect(flags('Vin mâine, nu trebuie să plătiți nimic în avans.', { known_contact: true })).not.toContain('RF_PAYMENT_REQUEST');
  });
});

describe('data request: "dai", "avem nevoie de", ID copies', () => {
  it.each([
    'Ca să primești banii, îmi dai numărul cardului?',
    'Pentru contract avem nevoie de CNP și seria de buletin.',
    'Trimiteți o copie după buletin, față-verso.',
    'Reply cu numele complet și CNP-ul.',
  ])('fires on "%s"', (t) => expect(flags(t)).toContain('RF_DATA_REQUEST'));
});

describe('code request: "confirmi cu codul"', () => {
  it('fires', () => expect(flags('Tu doar confirmi cu codul care îți vine pe SMS.')).toContain('RF_CODE_REQUEST'));
  it('a genuine 2FA prompt to type the code into the app still does not fire', () => {
    expect(flags('Introduceți codul în aplicație pentru a finaliza autentificarea.', { name: 'BancaDunarea', address: 'BancaDunarea' })).not.toContain('RF_CODE_REQUEST');
  });
});

describe('impersonation: "vă sun de la", English support calls, "loteria noastră"', () => {
  it.each([
    'Bună ziua, vă sun de la departamentul de securitate al băncii.',
    'Hello, this is Microsoft support, aveți o problemă.',
    'Ați câștigat la loteria noastră internațională.',
  ])('fires on "%s"', (t) => expect(flags(t)).toContain('RF_IMPERSONATION'));
});

describe('remote access without a named tool', () => {
  it.each(['Instalați programul de pe site ca să mă conectez la calculator.', 'Dați-mi acces acum, e urgent.'])(
    'fires on "%s"',
    (t) => expect(flags(t)).toContain('RF_REMOTE_ACCESS'),
  );
});

describe('unofficial link the reader is asked to use', () => {
  it('fires for a plain .net link to install from', () => {
    expect(flags('Descărcați aplicația de pe ajutor-rapid.net acum.')).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('an official link is still fine', () => {
    expect(flags('Detalii și plată pe curierexpres.ro', { name: 'CurierExpres', address: 'CurierExpres' })).not.toContain('RF_SUSPICIOUS_CONTACT');
  });
});

describe('soft flags: job pay per day, overpaying buyer, shame, secrecy, prison, channel', () => {
  it('too good', () => {
    expect(flags('Oferim job de acasă, 250 lei/zi.')).toContain('RF_TOO_GOOD');
    expect(flags('Îți dau 200 lei în plus dacă mi-l păstrezi.')).toContain('RF_TOO_GOOD');
  });
  it('emotional pressure', () => expect(flags('Mi-e rușine să le spun alor mei.')).toContain('RF_EMOTIONAL_PRESSURE'));
  it('secrecy', () => expect(flags('Nu aveți voie să spuneți familiei.')).toContain('RF_SECRECY'));
  it('threat', () => expect(flags('Altfel puteți ajunge la închisoare.')).toContain('RF_THREAT'));
  it('a scary word inside a link is not a threat, the same word in a sentence is', () => {
    expect(flags('Salut, intră pe site-ul meu: https://malware.com')).not.toContain('RF_THREAT');
    expect(flags('Calculatorul are un malware, trebuie curățat.')).toContain('RF_THREAT');
  });
  it('channel switch', () => expect(flags('Vă adaug într-un grup pe Telegram.')).toContain('RF_CHANNEL_SWITCH'));
  it('new number written as "nr"', () => expect(flags('Salut, mi-am schimbat nr, salvează-l.')).toContain('RF_NEW_NUMBER'));
});

describe('type decision list', () => {
  const typeOf = async (msgs: string[]): Promise<string> =>
    (
      await analyze({
        id: 'T',
        channel: 'chat',
        sender: { name: null, address: '+40 7xx xxx 100', known_contact: false },
        messages: msgs.map((text, i) => ({ n: i + 1, from: 'sender', text })),
      })
    ).scamType;
  it('"Banca vă anunță" is a bank story, not a marketplace listing', async () => {
    expect(await typeOf(['Banca Dunărea vă anunță o actualizare. Autentificați-vă pe dunarea-cont.net și introduceți parola.'])).toBe('BANK_IMPERSONATION');
  });
  it('a romance hook that mentions customs is still romance', async () => {
    expect(await typeOf(['Iubirea mea, mi-e dor de tine.', 'Sunt blocat la vamă, îmi trebuie 800 de euro ca să vin. Te implor.'])).toBe('ROMANCE');
  });
  it('a contact asking for a CNP and a bank account is not a fake bank', async () => {
    expect(await typeOf(['Ce mai faci?', 'Dă-mi CNP-ul tău, te rog.', 'Dă-mi și mie contul tău bancar.'])).toBe('OTHER');
  });
  it('a fake employer asking for an ID copy and a verification code is a job scam', async () => {
    expect(await typeOf(['Pentru post și salariu avem nevoie de o copie după buletin și codul de verificare primit pe SMS.'])).toBe('JOB_OFFER');
  });
});
