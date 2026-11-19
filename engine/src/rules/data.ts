import type { Hit } from '@ss/contracts';
import { extractUrls } from '../normalize';
import { hostOf, isOfficialHost, ORGS } from './contact';
import { senderIsAnyOrg } from './sender';
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

/** At least one link, and every link is on an official catalog domain. */
function allLinksOfficial(m: MsgCtx): boolean {
  const urls = extractUrls(m.raw);
  return urls.length > 0 && urls.every((u) => ORGS.some((o) => isOfficialHost(hostOf(u), o.site)));
}

function bankAccountAccess(m: MsgCtx, senderVerified: boolean): Hit | null {
  for (const match of m.norm.matchAll(BANK_ACCOUNT_RE)) {
    const idx = match.index ?? 0;
    if (isDenied(m.norm, idx)) continue;
    if (senderVerified || allLinksOfficial(m)) continue;
    return makeHit('RF_DATA_REQUEST', m, idx, match[0].length);
  }
  return null;
}

export const dataRequest: Rule = (c) => {
  const senderVerified = senderIsAnyOrg(c.scenario.sender);
  return perSenderMessage(c, (m) => firstHit('RF_DATA_REQUEST', m, RE) ?? bankAccountAccess(m, senderVerified));
};
