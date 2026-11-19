import type { Hit, Scenario } from '@ss/contracts';
import { extractEmails, extractPhones, extractUrls } from '../normalize';
import { hostOf, isOfficialHost, ORGS, type Org } from './contact';
import { senderIsOrg } from './sender';
import { GAP, NOT, firstHit, isDenied, makeHit, perSenderMessage, type MsgCtx, type Rule } from './util';

const NOUN = String.raw`(?:cvv2?|cvc2?|cnp|pin|numar(?:ul)?\s+(?:de\s+)?(?:card(?:ului)?|cont(?:ului)?)|date(?:le)?\s+(?:de\s+)?(?:card(?:ului)?|bancare|personale|de\s+autentificare|de\s+acces|de\s+identificare|de\s+logare|contului)|data\s+expirarii|serie(?:a)?(?:\s+si\s+numar(?:ul)?)?\s+(?:de\s+)?(?:buletin|ci)|parola|datele\s+(?:dvs|tale|dumneavoastra)|credentiale\w*)`;
const VERB = String.raw`(?:trimit\w*|spun\w*|comunic\w*|dati|furniz\w*|transmit\w*|introdu\w*|completa(?:ti)?|actualiza(?:ti)?|confirma(?:ti)?|verifica(?:ti)?|dezvalui\w*|scrie(?:ti)?)`;

const RE = new RegExp(`${NOT}\\b${VERB}\\b${GAP}\\b${NOUN}\\b|\\b${NOUN}\\b${GAP}${NOT}\\b${VERB}\\b`, 'g');

/**
 * Asking the reader to log in to THEIR bank account is a data request ("intrati in contul de banca",
 * "logati-va in aplicatia bancii").
 *
 * It is NOT switched off by wording in the message: a phishing text can say "Banca Dunarea" as easily as a genuine one.
 * Only things the attacker cannot simply write into the text exempt it (see verifiedContext): a verified sender, or
 * links that all point at an official site.
 */
const ACCESS_VERB = String.raw`(?:intrati|intra|logati(?:-va)?|conectati(?:-va)?|autentificati(?:-va)?|accesati|deschideti)`;
const BANK_ACCOUNT_RE = new RegExp(
  String.raw`${NOT}\b${ACCESS_VERB}\b[^!?;\n]{0,20}\b(?:contul|cont|contului|aplicatia|aplicatiei)\b[^!?;\n]{0,15}\bbanc(?:a|ii|ar\w*)\b`,
  'g',
);


const officialHost = (host: string): boolean => ORGS.some((o) => isOfficialHost(host, o.site));

/**
 * Every link, e-mail address and phone number in the message is official (vacuously true when there are none).
 * Without this, a verified sender or an official link next to "sunati la 0721 ..." would switch the rule off while
 * still sending the reader to the scammer.
 */
function allContactsOfficial(m: MsgCtx): boolean {
  const emailsOk = extractEmails(m.raw).every((e) => officialHost(e.toLowerCase().slice(e.lastIndexOf('@') + 1)));
  const phonesOk = extractPhones(m.raw).every((p) => ORGS.some((o) => o.phones.includes(p)));
  return extractUrls(m.raw).every((u) => officialHost(hostOf(u))) && emailsOk && phonesOk;
}

/**
 * The catalog has no organisation type, so a bank is recognised by "banc" in its name.
 * Only a verified BANK sender can vouch for a request to log in to a bank account: a verified shop sending the same
 * words is the scam. Nothing in the message text is consulted (a text can name any organisation it likes).
 */
const isBank = (o: Org): boolean => o.nameSrc.includes('banc');
const senderIsVerifiedBank = (sender: Scenario['sender']): boolean => ORGS.some((o) => isBank(o) && senderIsOrg(sender, o));

/**
 * Exempt only if every contact in the message is official AND there is positive evidence: a verified bank sender, or
 * at least one official link to go with it. A verified bank sender with a foreign link is NOT exempt.
 */
function exempt(m: MsgCtx, sender: Scenario['sender']): boolean {
  if (!allContactsOfficial(m)) return false;
  return senderIsVerifiedBank(sender) || extractUrls(m.raw).length > 0;
}

function bankAccountAccess(m: MsgCtx, sender: Scenario['sender']): Hit | null {
  for (const match of m.norm.matchAll(BANK_ACCOUNT_RE)) {
    const idx = match.index ?? 0;
    if (isDenied(m.norm, idx) || exempt(m, sender)) continue;
    return makeHit('RF_DATA_REQUEST', m, idx, match[0].length);
  }
  return null;
}

export const dataRequest: Rule = (c) =>
  perSenderMessage(c, (m) => firstHit('RF_DATA_REQUEST', m, RE) ?? bankAccountAccess(m, c.scenario.sender));
