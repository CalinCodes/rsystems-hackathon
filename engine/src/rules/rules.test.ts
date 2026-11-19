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
    expect(flags(['Intrați https://bancadunarea.ro\@evil.com/x'])).toContain('RF_SUSPICIOUS_CONTACT');
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
