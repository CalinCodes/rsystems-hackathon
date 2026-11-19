import { describe, expect, it } from 'vitest';
import type { FlagCode, Scenario } from '@ss/contracts';
import { runRules } from './index';

function sc(texts: string[], sender: Partial<Scenario['sender']> = {}): Scenario {
  return {
    id: 'T',
    channel: 'sms',
    sender: { name: null, address: null, known_contact: false, ...sender },
    messages: texts.map((text, i) => ({ n: i + 1, from: 'sender' as const, text })),
  };
}
const flags = (texts: string[], sender?: Partial<Scenario['sender']>): FlagCode[] => [
  ...new Set(runRules(sc(texts, sender)).map((h) => h.flag)),
];

describe('code request', () => {
  it('flags asking for the code', () => {
    expect(flags(['Vă rog să-mi spuneți codul primit pe SMS'])).toContain('RF_CODE_REQUEST');
    expect(flags(['Care este codul primit?'])).toContain('RF_CODE_REQUEST');
  });
  it('ignores genuine OTP delivery and warnings', () => {
    expect(flags(['Banca Dunărea: Codul de confirmare este 483920. Nu îl comunicați nimănui.'])).toEqual([]);
    expect(flags(['Nu trimiteți codul nimănui, nici angajaților băncii.'])).toEqual([]);
  });
});

describe('remote access', () => {
  it('flags remote-control apps', () => {
    expect(flags(['Instalați AnyDesk ca să vă ajut'])).toContain('RF_REMOTE_ACCESS');
  });
  it('ignores warnings against them', () => {
    expect(flags(['Banca nu vă va cere niciodată să instalați AnyDesk.'])).toEqual([]);
  });
});

describe('data request', () => {
  it('flags card data requests', () => {
    expect(flags(['Confirmați numărul cardului și CVV-ul'])).toContain('RF_DATA_REQUEST');
  });
  it('ignores denials', () => {
    expect(flags(['Nu vă vom cere niciodată CVV-ul.'])).toEqual([]);
  });
});

describe('payment request', () => {
  it('flags requests for money, even with dotted amounts', () => {
    expect(flags(['Poți să-mi transferi 2.500 lei în IBAN-ul acesta?'])).toContain('RF_PAYMENT_REQUEST');
    expect(flags(['Plătiți taxa de livrare'])).toContain('RF_PAYMENT_REQUEST');
  });
  it('ignores past-tense notifications', () => {
    expect(flags(['Ați plătit 100 lei la MegaShop.'])).toEqual([]);
  });
});

describe('new number', () => {
  it('flags number-change stories', () => {
    expect(flags(['Mi-am schimbat numărul, salvează-l te rog'])).toContain('RF_NEW_NUMBER');
    expect(flags(['Telefonul vechi s-a stricat'])).toContain('RF_NEW_NUMBER');
  });
});

describe('suspicious contact', () => {
  it('accepts official links, subdomains and catalog phones', () => {
    expect(flags(['Banca Dunărea: detalii pe bancadunarea.ro sau la 0800 100 200'])).toEqual([]);
    expect(flags(['Banca Dunărea: vedeți app.bancadunarea.ro'])).toEqual([]);
  });
  it('flags lookalike and foreign links when an organisation is claimed', () => {
    expect(flags(['Banca Dunărea: accesați bancadunarea-securizat.example'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro.evil.com'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: https://bancadunarea.ro@evil.xyz/x'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('flags disguised authorities even with no organisation claimed', () => {
    expect(flags(['Intrați https://bancadunarea.ro@evil.com/x'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Intrați https://bancadunarea.ro\\@evil.com/x'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('treats a trailing-dot host as the same host', () => {
    expect(flags(['Banca Dunărea: https://bancadunarea.ro./cont'])).toEqual([]);
  });
  it('flags unofficial callback numbers and personal-mobile senders', () => {
    expect(flags(['CurierExpres: sunați la 0700 000 111'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: cont blocat'], { address: '+40 700 000 111' })).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('flags shorteners even with no organisation claimed', () => {
    expect(flags(['Vezi aici bit.ly/abc123'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Vezi aici example-blog.ro'])).toEqual([]);
  });
});

it('reader messages never raise flags', () => {
  const s = sc(['ok']);
  s.messages.push({ n: 2, from: 'reader', text: 'Îți transfer 500 lei acum' });
  expect(runRules(s)).toEqual([]);
});

describe('evasion resistance', () => {
  it('a denial in another clause does not silence a real request', () => {
    expect(flags(['Banca nu vă cere niciodată nimic, dar spuneți-mi codul primit'])).toContain('RF_CODE_REQUEST');
    expect(flags(['Nu vă vom cere niciodată datele cardului. Spuneți-mi acum CVV-ul'])).toContain('RF_DATA_REQUEST');
  });
  it('a number in the request does not turn it into code delivery', () => {
    expect(flags(['Spuneți-mi codul 123456 primit pe SMS'])).toContain('RF_CODE_REQUEST');
  });
  it('catches schemeless user@host/path links', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro@evil.xyz/login'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Intrați pe bancadunarea.ro@evil.xyz/login'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('flags risky email domains even with no organisation claimed', () => {
    expect(flags(['Scrieți la premii@promo.xyz'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Scrieți la ion@gmail.com'])).toEqual([]);
  });
});

describe('review follow-ups', () => {
  it('an organisation linking to its own site is fine', () => {
    expect(flags(['ANAF: detalii pe anaf.ro'])).toEqual([]);
  });
  it('judges the whole host, not an official-looking prefix', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro.evil.zzz'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro-login.zzz/x'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro.'])).toEqual([]);
  });
  it('a denial far from the request does not silence it', () => {
    // No comma between denial and request: only the distance limit separates them.
    expect(
      flags(['Banca nu vă cere nimic de la dumneavoastră și suntem foarte atenți la siguranța datelor dar spuneți-mi codul primit']),
    ).toContain('RF_CODE_REQUEST');
    expect(
      flags(['Nu vă vom cere nimic în plus față de ce ați discutat și ce am stabilit amândoi mai devreme dar instalați AnyDesk acum']),
    ).toContain('RF_REMOTE_ACCESS');
  });
  it('a denial right before the verb still wins', () => {
    expect(flags(['Banca nu vă va cere niciodată să instalați AnyDesk'])).toEqual([]);
    expect(flags(['Nu vă vom cere niciodată să ne spuneți codul primit'])).toEqual([]);
  });
});

describe('second review round', () => {
  it('a contrast word between denial and request cancels the denial', () => {
    expect(flags(['Nu vom cere nimic dar instalați AnyDesk'])).toContain('RF_REMOTE_ACCESS');
    expect(flags(['Nu vom cere niciodată să instalați AnyDesk'])).toEqual([]);
  });
  it('extracts hosts containing underscores', () => {
    expect(flags(['Banca Dunărea: intrați pe my_bancadunarea.ro.evil.zzz'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('flags homoglyph and diacritic hosts that imitate a claimed organisation', () => {
    expect(flags(['Banca Dunărea: intrați pe bаncadunarea.ro'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: intrați pe bancadunărea.ro'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('still accepts the real site', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro'])).toEqual([]);
  });
});

describe('invisible-character and IDNA obfuscation', () => {
  it('a zero-width space does not hide the real host', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro​.evil.zzz'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro­.evil.zzz'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('ideographic and fullwidth dots are read as dots', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea。ro。evil。zzz'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: intrați pe bancadunarea．ro．evil．zzz'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('a stray combining mark does not hide the real host', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ró.evil.zzz'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('invisible characters inside the organisation name still count as naming it', () => {
    expect(flags(['Banca Dun​ărea: intrați pe evil.xyz'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('invisible characters cannot hide a request phrase', () => {
    expect(flags(['Spune​ți-mi codul primit'])).toContain('RF_CODE_REQUEST');
  });
  it('genuine Romanian text and the real site are unaffected', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.ro'])).toEqual([]);
    expect(flags(['Banca Dunărea: Codul de confirmare este 483920. Nu îl comunicați nimănui.'])).toEqual([]);
  });
});

describe('IDN email addresses', () => {
  it('flags a homoglyph email domain, claimed organisation or not', () => {
    expect(flags(['Banca Dunărea: scrieți la suport@bаncadunarea.ro'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Scrieți la suport@bаncadunarea.ro'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Scrieți la suport@bancadunărea.ro'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('still accepts the official address', () => {
    expect(flags(['Banca Dunărea: scrieți la suport@bancadunarea.ro'])).toEqual([]);
  });
});

describe('tampering is judged on the original text', () => {
  it('an invisible character inside an otherwise official host is suspicious, not official', () => {
    expect(flags(['Banca Dunărea: intrați pe bancadunarea​.ro'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Banca Dunărea: intrați pe bancadunarea.r‍o'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('a combining mark with no precomposed form cannot be stripped into an official host', () => {
    expect(flags(['Banca Dunărea: intrați pe b̀ancadunarea.ro'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('works with no organisation named and for email addresses', () => {
    expect(flags(['Vezi evil.​ro'])).toContain('RF_SUSPICIOUS_CONTACT');
    expect(flags(['Scrieți la suport@bancadunarea.r‍o'])).toContain('RF_SUSPICIOUS_CONTACT');
  });
  it('decomposed Romanian letters are recomposed and do not trigger it', () => {
    expect(flags(['Banca Dunărea: vedeți bancadunarea.ro'])).toEqual([]);
  });
  it('ordinary text with a trailing invisible character is not a host', () => {
    expect(flags(['Ne vedem mâine​.'])).toEqual([]);
  });
});
