import type { Hit } from '@ss/contracts';
import catalog from '@ss/contracts/catalog.json';
import { extractEmails, extractPhones, extractUrls, normalizeText } from '../normalize';
import { makeHit, type MsgCtx, type Rule } from './util';

export interface Org {
  /** Display name from the catalog, e.g. "Banca Dunărea". */
  name: string;
  /** Normalized, space-tolerant name as regex source: "banca\s*dunarea". */
  nameSrc: string;
  site: string;
  phones: string[];
  /** "Banca Dunărea" → /\bbanca\s*dunarea\b/ so "BancaDunarea" and "banca dunarea" both match. */
  nameRe: RegExp;
}

const nameSource = (name: string): string => normalizeText(name).split(/\s+/).join('\\s*');

export const ORGS: Org[] = catalog.organisations.map((o) => ({
  name: o.name,
  nameSrc: nameSource(o.name),
  site: o.site,
  phones: o.phone ? [o.phone.replace(/\D/g, '')] : [],
  nameRe: new RegExp(`\\b${nameSource(o.name)}\\b`),
}));

const SHORTENERS = /^(?:bit\.ly|tinyurl\.com|cutt\.ly|t\.ly|rb\.gy|is\.gd|goo\.gl|ow\.ly)$/;
const RISKY_TLD = /\.(?:xyz|top|click|link|site|online|example)$/;
const MOBILE = /^(?:\+40|0040|0)7\d{8}$/;
const LINK_ACTION = /\b(?:accesa\w*|intra\w*|apasa\w*|click|completa\w*|introdu\w*|confirma\w*|confirmi|plat\w*|achit\w*|logheaz\w*|logati\w*|autentific\w*|descarc\w*|instal\w*|link\w*|formular\w*)\b/;

/**
 * Host as the victim's browser would resolve it (WHATWG parser), not string slicing:
 * "bancadunarea.ro@evil.xyz", "bancadunarea.ro\@evil.xyz" and trailing dots all differ between hand-rolled parsers.
 * Unparseable → '' which is never official, so it gets flagged.
 */
export const hostOf = (url: string): string => {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`);
    return u.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Userinfo or backslash in the authority is a classic way to make a link read as another domain. */
const hasDisguisedAuthority = (url: string): boolean => {
  const authority = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? '';
  return authority.includes('@') || authority.includes('\\');
};

/**
 * Non-ASCII letters or an "xn--" label: homoglyph hosts ("bаncadunarea.ro" with a Cyrillic а) look official to a human.
 * None of the catalog's real domains are IDNs, so any such host is suspicious on its own.
 */
const hasExoticHost = (url: string, host: string): boolean => {
  const authority = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? '';
  return /[^\x00-\x7f]/.test(authority) || host.split('.').some((l) => l.startsWith('xn--'));
};

/** Exact match or true subdomain: "bancadunarea.ro.evil.com" must NOT pass. */
export const isOfficialHost = (host: string, site: string): boolean => host === site || host.endsWith(`.${site}`);

const claimedIn = (text: string): Org[] => ORGS.filter((o) => o.nameRe.test(text));

// NFKC already folds U+FF0E to "." and U+FF61 to U+3002, so those two are the only dot lookalikes left to match.
// The leading lookbehind makes a match start only at the START of a run. Without it the engine retries from every
// position inside a long run, scanning to its end each time: quadratic (5 s on 20k zero-width characters).
const HOST_RUN = /(?<![\p{L}\p{N}\p{M}\p{Cf}_@+%-])[\p{L}\p{N}\p{M}\p{Cf}_@+%-]+(?:[.。][\p{L}\p{N}\p{M}\p{Cf}_@+%-]+)+/gu;
const INVISIBLE = /[\p{Cf}\p{M}]/u;

/**
 * canonicalize() strips invisible and combining characters so rules can read the text, but that also erases the
 * evidence of tampering: "b̀ancadunarea.ro" would come out as the official host. So the decision is made on
 * the ORIGINAL text: a host-like token that still holds such characters after NFKC is suspicious in itself.
 * (NFKC first, so a decomposed Romanian "ă" = a + breve is recomposed and does not trigger this.)
 */
function obfuscatedHostToken(orig: string): string | null {
  // Scan for runs of host characters instead of splitting on a list of separators: a host then ends at ANY
  // character outside the class ("=", "\", "[", "|", quotes, "/", ":"...), so no separator can be used to
  // hide it, and the BOM (a format character) is part of the run rather than a cut point.
  for (const m of orig.normalize('NFKC').matchAll(HOST_RUN)) {
    if (INVISIBLE.test(m[0])) return m[0];
  }
  return null;
}

function messageHits(m: MsgCtx, claimed: Org[]): Hit[] {
  const out: Hit[] = [];
  const flag = (what: string): void => void out.push({ flag: 'RF_SUSPICIOUS_CONTACT', msg: m.n, evidence: what.slice(0, 80), src: 'rule' });

  if (obfuscatedHostToken(m.orig) !== null) flag('obfuscated host');

  for (const url of extractUrls(m.raw)) {
    const host = hostOf(url);
    // Official means official FOR THE CLAIMED ORG: a "Banca Dunărea" text linking to anaf.ro is still a mismatch.
    const official = (claimed.length > 0 ? claimed : ORGS).some((o) => isOfficialHost(host, o.site));
    if (hasDisguisedAuthority(url) || hasExoticHost(url, host) || host === '') flag(url);
    else if (SHORTENERS.test(host)) flag(url);
    else if (claimed.length > 0 && !official) flag(url);
    else if (claimed.length === 0 && RISKY_TLD.test(host)) flag(url);
    // Brief: any link not on the official list. A friend sharing an article is not asked to act on it, so an
    // unofficial link counts when the message asks the reader to use it (install, pay, log in, fill in...).
    else if (!official && LINK_ACTION.test(m.norm)) flag(url);
  }
  for (const email of extractEmails(m.raw)) {
    // The domain is whatever follows the LAST "@" (that is where mail is delivered); a second "@" is itself a red flag.
    const domain = email.toLowerCase().slice(email.lastIndexOf('@') + 1);
    const foreign = claimed.length > 0 ? !claimed.some((o) => isOfficialHost(domain, o.site)) : SHORTENERS.test(domain) || RISKY_TLD.test(domain);
    if (foreign || email.indexOf('@') !== email.lastIndexOf('@') || hasExoticHost(domain, hostOf(domain))) flag(email);
  }
  if (claimed.length === 0) return out;

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
    ? !claimed.some((o) => isOfficialHost(address.toLowerCase().slice(address.lastIndexOf('@') + 1), o.site))
    : MOBILE.test(compact);
  return bad ? [makeHit('RF_SUSPICIOUS_CONTACT', m, 0, 0)].map((h) => ({ ...h, evidence: 'sender address' })) : [];
}

/** Which catalog sites (e.g. "bancadunarea.ro") are named in already-normalized text. */
export const claimedSites = (norm: string): string[] => claimedIn(norm).map((o) => o.site);

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
