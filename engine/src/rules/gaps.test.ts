import { describe, expect, it } from 'vitest';
import type { FlagCode, Scenario } from '@ss/contracts';
import { analyze } from '../index';
import { runRules } from './index';

// All sentences here are invented for these tests (none come from any provided dataset), on purpose: the rules are
// meant to generalise, so each test uses wording the rule was NOT written against.

type Turn = [from: 'sender' | 'reader', text: string];

function thread(turns: Turn[], sender: Partial<Scenario['sender']> = {}): Scenario {
  return {
    id: 'T',
    channel: 'sms',
    sender: { name: null, address: null, known_contact: false, ...sender },
    messages: turns.map(([from, text], i) => ({ n: i + 1, from, text })),
  };
}
const flagsOf = (s: Scenario): FlagCode[] => [...new Set(runRules(s).map((h) => h.flag))];
const flags = (text: string, sender?: Partial<Scenario['sender']>): FlagCode[] => flagsOf(thread([['sender', text]], sender));

describe('1. urgency', () => {
  it.each([
    'Răspundeți în 36h',
    'Mai aveți 48 h la dispoziție',
    'Achitați până la 03.11',
    'Rezolvăm până la 7 octombrie',
    'Vă rog sunați azi',
    'Ne auzim astăzi',
    'Ajung într-o oră',
    'Oferta expiră',
    'Grăbiți-vă',
    'Grăbește-te',
    'Doar 30 min rămase',
    'Spuneți acum',
  ])('fires on "%s"', (text) => expect(flags(text)).toContain('RF_URGENCY'));
  it.each(['Cu drag, Ana', 'Ne vedem sâmbătă la cafea', 'Mulțumesc pentru ajutor'])('stays quiet on "%s"', (text) =>
    expect(flags(text)).not.toContain('RF_URGENCY'),
  );
});

describe('2. payment request', () => {
  it.each([
    'Poți să-mi faci un transfer până diseară?',
    'Îmi poți trimite 1.850 lei?',
    'Trimite-mi 1 850 lei',
    'Virează 300 € mâine',
    'Am nevoie urgent de un transfer de 4.200 lei',
    'Am nevoie de bani',
    'Fă un virament de 90 RON',
    'Retrageți toți banii din cont',
    // review round: junk before the amount must not hide it
    'Trimiteți .5 100 lei',
    'Trimiteți 2 .100 lei',
  ])('fires on "%s"', (text) => expect(flags(text)).toContain('RF_PAYMENT_REQUEST'));
  it.each(['Transferul de 500 lei a fost efectuat', 'Ați plătit 100 lei la magazin', 'Costul este 25 lei'])(
    'stays quiet on "%s"',
    (text) => expect(flags(text)).not.toContain('RF_PAYMENT_REQUEST'),
  );
});

describe('3. secrecy', () => {
  it.each([
    'Nu-i spune lui Radu',
    'Nu spune la nimeni',
    'Să rămână între noi',
    'Păstrează secretul',
    'E secret, ok?',
    'Nu le zice nimic celorlalți',
  ])('fires on "%s"', (text) => expect(flags(text)).toContain('RF_SECRECY'));
  it.each(['Nu îl comunicați nimănui.', 'Spune-i lui Radu salutări', 'Nu spuneți nimănui codul primit'])('stays quiet on "%s"', (text) =>
    expect(flags(text)).not.toContain('RF_SECRECY'),
  );
});

describe('4. code request with object clitics', () => {
  it('fires when a code is mentioned in the same sentence', () => {
    expect(flags('Ți-a venit un cod pe SMS. Mi-l trimiți și mie?')).toContain('RF_CODE_REQUEST');
    expect(flags('Dă-mi-l repede, e codul din SMS')).toContain('RF_CODE_REQUEST');
    expect(flags('Cititi-mi codul de pe telefon')).toContain('RF_CODE_REQUEST');
  });
  it('fires when the code was mentioned in the previous message', () => {
    const s = thread([
      ['sender', 'Am greșit numărul și ți-a ajuns un cod de șase cifre.'],
      ['reader', 'Da, am primit ceva.'],
      ['sender', 'Mi-l poți trimite înapoi, te rog?'],
    ]);
    expect(flagsOf(s)).toContain('RF_CODE_REQUEST');
  });
  it('stays quiet with no code context, and for "I will send it" (first person)', () => {
    expect(flags('Mi-l trimiți mâine, e cadoul pentru Ana')).not.toContain('RF_CODE_REQUEST');
    expect(flags('Îl trimit mâine Anei, e din partea mea')).not.toContain('RF_CODE_REQUEST');
  });
});

describe('5. data request', () => {
  it.each([
    'Trimiteți CNP-ul',
    'Spuneți-mi numărul cardului',
    'Introduceți PIN-ul',
    'Intrați în contul de bancă și confirmați',
    'Logați-vă în aplicația băncii acum',
    'Completați datele cardului',
  ])('fires on "%s"', (text) => expect(flags(text)).toContain('RF_DATA_REQUEST'));
  it('does not treat a genuine "log in on our site" as a data request', () => {
    expect(flags('Intrați în contul dumneavoastră de pe bancadunarea.ro')).not.toContain('RF_DATA_REQUEST');
  });
});

describe('6. impersonation', () => {
  it.each([
    'Aici suportul tehnic Windows',
    'Sunt Mihai de la Casa de Pensii',
    'Casa de Pensii: aveți o restanță',
    'Ministerul Finanțelor vă informează',
    'DGASPC vă anunță',
    'Operatorul de telefonie vă informează',
    'Vă contactez din partea Poliției',
    'Sunt ofițer la Poliția Capitalei',
  ])('fires on "%s"', (text) => expect(flags(text)).toContain('RF_IMPERSONATION'));

  it('a catalog org claimed by an unknown phone number with no link fires', () => {
    const s = thread([['sender', 'MegaShop: comanda dvs. a fost expediată']], { address: '+40 721 555 000' });
    expect(flagsOf(s)).toContain('RF_IMPERSONATION');
  });
  it('...but not when the sender id names the org, or the number is a known contact', () => {
    // (A shop whose name matches but texts from a private MOBILE is still flagged by the contact rule; this test is about
    // the impersonation rule on its own, so the named sender uses a non-numeric id.)
    const named = thread([['sender', 'MegaShop: comanda dvs. a fost expediată']], { name: 'MegaShop', address: 'MegaShop' });
    const known = thread([['sender', 'MegaShop: comanda dvs. a fost expediată']], { address: '+40 721 555 000', known_contact: true });
    expect(flagsOf(named)).not.toContain('RF_IMPERSONATION');
    expect(flagsOf(known)).not.toContain('RF_IMPERSONATION');
  });
  it('merely mentioning a platform or feature is not a claim to be it', () => {
    expect(flags('Am plătit prin Livrare Sigură, mai e disponibil?', { address: '+40 721 555 000' })).not.toContain('RF_IMPERSONATION');
    expect(flags('Îl vând pe PiațaMea, e disponibil', { address: '+40 721 555 000' })).not.toContain('RF_IMPERSONATION');
  });
  it('a genuine warning about bank staff is not a claim to be bank staff', () => {
    expect(flags('Nu spuneți nimic nici angajaților băncii')).not.toContain('RF_IMPERSONATION');
  });
  it('analyze() reports which catalog org is impersonated', async () => {
    const claimed = await analyze(thread([['sender', 'MegaShop: comanda dvs. a fost expediată']], { address: '+40 721 555 000' }));
    expect(claimed.impersonatedOrg).toBe('MegaShop');
    const generic = await analyze(thread([['sender', 'Aici suportul tehnic Windows, aveți viruși']]));
    expect(generic.impersonatedOrg).toBeNull();
  });
});

describe('7. threat', () => {
  it.each([
    'Calculatorul dvs. a fost infectat cu viruși',
    'Contul va fi închis mâine',
    'Telefonul este blocat',
    'Calculatorul dvs. trimite date către hackeri',
    'Veți pierde banii',
  ])('fires on "%s"', (text) => expect(flags(text)).toContain('RF_THREAT'));
  it.each(['Ca să nu pierdeți ocazia, sunați', 'Pentru a nu pierde termenul de înscriere, veniți', 'Nu vă pierdeți timpul'])(
    '10. stays quiet on loss-aversion "%s"',
    (text) => expect(flags(text)).not.toContain('RF_THREAT'),
  );
});

describe('8. too good to be true', () => {
  it.each([
    'Avem vești bune pentru dumneavoastră',
    'Pensia va crește cu 15%',
    'Veți primi o rambursare',
    'Veți primi 500 lei',
    'Profit garantat în două săptămâni',
    'Ați câștigat un weekend la mare',
  ])('fires on "%s"', (text) => expect(flags(text)).toContain('RF_TOO_GOOD'));
  it.each(['Serviciul de suport este gratuit', 'Consultația este gratis', 'Veți primi coletul mâine'])(
    '9. stays quiet on "%s"',
    (text) => expect(flags(text)).not.toContain('RF_TOO_GOOD'),
  );
});

describe('12-13. scam-type decision list', () => {
  const typeOf = async (text: string, sender?: Partial<Scenario['sender']>): Promise<string> =>
    (await analyze(thread([['sender', text]], sender))).scamType;

  it('selling context wins over the courier type ("Livrare Sigură" is a marketplace feature)', async () => {
    expect(
      await typeOf('Sunt interesat de anunț, mai este disponibil? Am plătit prin Livrare Sigură, introduceți datele cardului aici: https://plata-livrare.example/x'),
    ).toBe('MARKETPLACE');
  });
  it('a courier fee with no selling context is still a courier fee', async () => {
    expect(await typeOf('CurierExpres: Coletul dvs. nu poate fi livrat. Plătiți taxa de 9,99 lei: curierexpres-colet.example')).toBe('COURIER_FEE');
  });
  it('Casa de Pensii counts as an authority, even when card or bank words appear', async () => {
    expect(await typeOf('Casa de Pensii: avem vești bune, pensia va crește. Transmiteți CNP-ul și numărul cardului')).toBe('AUTHORITY_IMPERSONATION');
  });
  it('tech-support wording with a scare is tech support even without a remote-access tool', async () => {
    expect(await typeOf('Aici suportul tehnic Windows. Calculatorul dvs. are viruși, intrați în contul de bancă să verificăm')).toBe('TECH_SUPPORT');
  });
});

describe('review round: addresses and hostile input', () => {
  it('junk after an address does not make it vanish', () => {
    const msg = 'Banca Dunărea: scrieți la ';
    expect(flags(msg + 'scam@evil.xyz@')).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(msg + 'scam@evil.xyz@1')).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(msg + 'scam@evil.xyz%junk')).toContain('RF_SUSPICIOUS_CONTACT');
  });
});

describe('review round: trust only what the attacker cannot write', () => {
  const shop = 'MegaShop: comanda dvs. a fost expediată';

  it('a display name does not vouch for a phone number', () => {
    // A landline-style number, so only the impersonation rule (not the mobile-sender contact rule) can fire.
    const spoofed = thread([['sender', shop]], { name: 'MegaShop', address: '031 555 00 00' });
    expect(flagsOf(spoofed)).toContain('RF_IMPERSONATION');
  });
  it("a catalog organisation's own phone number does verify the sender", () => {
    const real = thread([['sender', shop]], { address: '0800 500 600' });
    expect(flagsOf(real)).not.toContain('RF_IMPERSONATION');
  });
  it('a known contact is still exempt', () => {
    const known = thread([['sender', shop]], { name: 'MegaShop', address: '031 555 00 00', known_contact: true });
    expect(flagsOf(known)).not.toContain('RF_IMPERSONATION');
  });

  const login = 'Intrați în contul Banca Dunărea și confirmați';
  it('writing the bank name in the text does not switch the data-request rule off', () => {
    expect(flags(login)).toContain('RF_DATA_REQUEST');
    expect(flags('Intrați în contul de bancă și confirmați')).toContain('RF_DATA_REQUEST');
  });
  it('a verified sender, or only official links, does exempt it', () => {
    expect(flags(login, { name: 'Banca Dunărea', address: 'BancaDunarea' })).not.toContain('RF_DATA_REQUEST');
    expect(flags('Intrați în contul de bancă pe bancadunarea.ro')).not.toContain('RF_DATA_REQUEST');
  });
  it('...but a lookalike link, or one lookalike among official ones, does not', () => {
    expect(flags('Intrați în contul de bancă pe bancadunarea-x.example')).toContain('RF_DATA_REQUEST');
    expect(flags('Intrați în contul de bancă: bancadunarea.ro sau bancadunarea-x.example')).toContain('RF_DATA_REQUEST');
  });
  it('a phone sender cannot use a bank-sounding name to exempt it', () => {
    expect(flags(login, { name: 'Banca Dunărea', address: '+40 721 555 000' })).toContain('RF_DATA_REQUEST');
  });
});

describe('review round 3: only the ADDRESS vouches, and only whole-address matches', () => {
  const login = 'Intrați în contul Banca Dunărea și confirmați';
  const shop = 'MegaShop: comanda dvs. a fost expediată';

  it('an e-mail sender is judged by its domain only: name and local part are free text', () => {
    expect(flags(login, { name: 'Banca Dunărea', address: 'support@evil.xyz' })).toContain('RF_DATA_REQUEST');
    expect(flags(login, { address: 'bancadunarea@evil.xyz' })).toContain('RF_DATA_REQUEST');
    expect(flags(login, { address: 'notificari@bancadunarea.ro' })).not.toContain('RF_DATA_REQUEST');
    expect(flags(login, { address: 'notificari@alerte.bancadunarea.ro' })).not.toContain('RF_DATA_REQUEST');
  });
  it('a display name with no address verifies nothing', () => {
    expect(flags(login, { name: 'Banca Dunărea' })).toContain('RF_DATA_REQUEST');
    expect(flags(login, { name: 'Banca Dunărea', address: null })).toContain('RF_DATA_REQUEST');
  });
  it('a phone address must be exactly one catalog number, not "the first number found"', () => {
    const twoNumbers = thread([['sender', shop]], { address: '0800 500 600 0721 555 000' });
    expect(flagsOf(twoNumbers)).toContain('RF_IMPERSONATION');
    const withPrefix = thread([['sender', shop]], { address: '+40 800 500 600' });
    expect(flagsOf(withPrefix)).not.toContain('RF_IMPERSONATION');
    const catalogNational = thread([['sender', shop]], { address: '0800 500 600' });
    expect(flagsOf(catalogNational)).not.toContain('RF_IMPERSONATION');
  });
  it('an official link does not exempt a message that also gives a foreign phone number or e-mail', () => {
    expect(flags('Intrați în contul de bancă pe bancadunarea.ro')).not.toContain('RF_DATA_REQUEST');
    expect(flags('Intrați în contul de bancă pe bancadunarea.ro sau sunați la 0721 555 000')).toContain('RF_DATA_REQUEST');
    expect(flags('Intrați în contul de bancă pe bancadunarea.ro sau scrieți la ajutor@evil.xyz')).toContain('RF_DATA_REQUEST');
  });
  it('official link plus the catalog phone and e-mail is still exempt', () => {
    expect(flags('Intrați în contul de bancă pe bancadunarea.ro sau sunați la 0800 100 200')).not.toContain('RF_DATA_REQUEST');
    expect(flags('Intrați în contul de bancă pe bancadunarea.ro, scrieți la suport@bancadunarea.ro')).not.toContain('RF_DATA_REQUEST');
  });
});

describe('review round 4: an alphanumeric sender id must BE the name, not contain it', () => {
  const login = 'Intrați în contul Banca Dunărea și confirmați';
  it.each(['BancaDunarea', 'BANCADUNAREA', 'Banca Dunarea'])('verifies the exact id "%s"', (id) => {
    expect(flags(login, { address: id })).not.toContain('RF_DATA_REQUEST');
  });
  it.each(['BancaDunarea-Alerte', 'Fake BancaDunarea', 'BancaDunarea 0721555000', 'BancaDunarea.xyz', 'MegaShop'])(
    'does not verify "%s" as the bank',
    (id) => {
      expect(flags(login, { address: id })).toContain('RF_DATA_REQUEST');
    },
  );
  it('a shop id that merely contains the name does not clear impersonation from a phone-looking id', () => {
    const s = thread([['sender', 'MegaShop: comanda dvs. a fost expediată']], { address: '0721 555 000' });
    expect(flagsOf(s)).toContain('RF_IMPERSONATION');
  });
});

describe('review round 5: the data-request exemption trusts no text and no non-bank', () => {
  const login = 'Intrați în contul de bancă și confirmați';

  it('a verified SHOP cannot exempt it, even by writing its own name in the text', () => {
    expect(flags(login, { address: 'MegaShop' })).toContain('RF_DATA_REQUEST');
    expect(flags('MegaShop: intrați în contul de bancă și confirmați', { address: 'MegaShop' })).toContain('RF_DATA_REQUEST');
    expect(flags('Intrați în contul de bancă și confirmați, MegaShop vă mulțumește', { address: 'megashop.ro@megashop.ro' })).toContain('RF_DATA_REQUEST');
  });
  it('a verified BANK with no foreign contacts is exempt', () => {
    expect(flags(login, { address: 'BancaDunarea' })).not.toContain('RF_DATA_REQUEST');
    expect(flags(login, { address: 'alerte@bancadunarea.ro' })).not.toContain('RF_DATA_REQUEST');
  });
  it('a verified bank sender does NOT exempt a message carrying a foreign link, number or address', () => {
    const bank = { address: 'BancaDunarea' };
    expect(flags(`${login}: bancadunarea-x.example`, bank)).toContain('RF_DATA_REQUEST');
    expect(flags(`${login}, sunați la 0721 555 000`, bank)).toContain('RF_DATA_REQUEST');
    expect(flags(`${login}, scrieți la ajutor@evil.xyz`, bank)).toContain('RF_DATA_REQUEST');
  });
  it('an unverified sender is exempt only through official links, with every contact official', () => {
    expect(flags(`${login} pe bancadunarea.ro`)).not.toContain('RF_DATA_REQUEST');
    expect(flags(login)).toContain('RF_DATA_REQUEST');
  });
});
