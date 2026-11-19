import { describe, expect, it } from 'vitest';
import type { Scenario } from '@ss/contracts';
import { analyze } from './index';

const one = (text: string, address: string | null = null): Scenario => ({
  id: 'T',
  channel: 'sms',
  sender: { name: null, address, known_contact: false },
  messages: [{ n: 1, from: 'sender', text }],
});
const typeOf = async (text: string, address?: string): Promise<string> => (await analyze(one(text, address ?? null))).scamType;

describe('type decision list', () => {
  it('bank phishing', async () => {
    expect(await typeOf('Banca Dunărea: Cardul dvs. a fost blocat. Accesați în 2 ore: bancadunarea-securizat.example')).toBe('BANK_IMPERSONATION');
  });
  it('bank named in an inflected form ("Băncii") still reads as a bank story', async () => {
    expect(await typeOf('Sunt Radu, de la serviciul clienți al Băncii Dunărea. Spuneți-mi codul din SMS.')).toBe('BANK_IMPERSONATION');
  });
  it('courier fee', async () => {
    expect(await typeOf('CurierExpres: Coletul dvs. nu poate fi livrat. Plătiți taxa de 9,99 lei: curierexpres-colet.example')).toBe('COURIER_FEE');
  });
  it('tech support', async () => {
    expect(await typeOf('Calculatorul dvs. are virus. Instalați AnyDesk pentru a vă ajuta')).toBe('TECH_SUPPORT');
  });
  it('account takeover', async () => {
    expect(await typeOf('Am trimis din greșeală un cod pe WhatsApp, mi-l spui și mie?')).toBe('ACCOUNT_TAKEOVER');
  });
  it('remote access alone still reads as tech support', async () => {
    expect((await analyze(one('Instalați acum AnyDesk', null))).scamType).toBe('TECH_SUPPORT');
  });
  it('flagged but unmatched falls back to OTHER', async () => {
    expect(await typeOf('Aveți ceva de plătit: trimiteți 300 lei')).toBe('OTHER');
  });
  it('SAFE is always NONE', async () => {
    expect(await typeOf('Ne vedem mâine la cafea')).toBe('NONE');
  });
});
