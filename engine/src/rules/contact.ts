import type { Hit } from '@ss/contracts';
import catalog from '@ss/contracts/catalog.json';
import { extractEmails, extractPhones, extractUrls, normalizeText } from '../normalize';
import { makeHit, type MsgCtx, type Rule } from './util';

interface Org {
  site: string;
  phones: string[];
  /** "Banca Dunărea" → /\bbanca\s*dunarea\b/ so "BancaDunarea" and "banca dunarea" both match. */
  nameRe: RegExp;
}

const ORGS: Org[] = catalog.organisations.map((o) => ({
  site: o.site,
  phones: o.phone ? [o.phone.replace(/\D/g, '')] : [],
  nameRe: new RegExp(`\\b${normalizeText(o.name).split(/\s+/).join('\\s*')}\\b`),
}));

const SHORTENERS = /^(?:bit\.ly|tinyurl\.com|cutt\.ly|t\.ly|rb\.gy|is\.gd|goo\.gl|ow\.ly)$/;
const RISKY_TLD = /\.(?:xyz|top|click|link|site|online|example)$/;
const MOBILE = /^(?:\+40|0040|0)7\d{8}$/;

/** Authority only, minus userinfo and port: "bancadunarea.ro@evil.xyz" is really host evil.xyz. */
const hostOf = (url: string): string => {
  const authority = url.toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0] ?? '';
  const afterUser = authority.slice(authority.lastIndexOf('@') + 1);
  return (afterUser.split(':')[0] ?? '').replace(/^www\./, '');
};

/** Exact match or true subdomain: "bancadunarea.ro.evil.com" must NOT pass. */
const isOfficialHost = (host: string, site: string): boolean => host === site || host.endsWith(`.${site}`);

const claimedIn = (text: string): Org[] => ORGS.filter((o) => o.nameRe.test(text));

function messageHits(m: MsgCtx, claimed: Org[]): Hit[] {
  const out: Hit[] = [];
  const flag = (what: string): void => void out.push({ flag: 'RF_SUSPICIOUS_CONTACT', msg: m.n, evidence: what.slice(0, 80), src: 'rule' });

  for (const url of extractUrls(m.raw)) {
    const host = hostOf(url);
    const official = ORGS.some((o) => isOfficialHost(host, o.site));
    if (SHORTENERS.test(host)) flag(url);
    else if (claimed.length > 0 && !official) flag(url);
    else if (claimed.length === 0 && RISKY_TLD.test(host)) flag(url);
  }
  if (claimed.length === 0) return out;

  for (const email of extractEmails(m.raw)) {
    const domain = email.toLowerCase().split('@')[1] ?? '';
    if (!claimed.some((o) => isOfficialHost(domain, o.site))) flag(email);
  }
  for (const phone of extractPhones(m.raw)) {
    if (!claimed.some((o) => o.phones.includes(phone))) flag(phone);
  }
  return out;
}

/** Sender-level check: a bank texting from a personal mobile or a free-mail address. */
function senderHits(c: Parameters<Rule>[0], m: MsgCtx, claimed: Org[]): Hit[] {
  const { address, known_contact } = c.scenario.sender;
  if (!address || known_contact || claimed.length === 0) return [];
  const compact = address.replace(/[\s.-]/g, '');
  const bad = address.includes('@')
    ? !claimed.some((o) => isOfficialHost(address.toLowerCase().split('@')[1] ?? '', o.site))
    : MOBILE.test(compact);
  return bad ? [makeHit('RF_SUSPICIOUS_CONTACT', m, 0, 0)].map((h) => ({ ...h, evidence: 'sender address' })) : [];
}

export const suspiciousContact: Rule = (c) => {
  const nameClaims = claimedIn(normalizeText(`${c.scenario.sender.name ?? ''} ${c.scenario.sender.address ?? ''}`));
  const out: Hit[] = [];
  let senderDone = false;
  for (const m of c.msgs) {
    if (m.from !== 'sender') continue;
    const claimed = [...new Set([...nameClaims, ...claimedIn(m.norm)])];
    out.push(...messageHits(m, claimed));
    if (!senderDone && claimed.length > 0) {
      out.push(...senderHits(c, m, claimed));
      senderDone = true;
    }
  }
  return out;
};
