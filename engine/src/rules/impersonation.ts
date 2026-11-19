import type { Hit, Scenario } from '@ss/contracts';
import { normalizeText } from '../normalize';
import { ORGS, suspiciousContact, type Org } from './contact';
import { buildCtx, firstHit, perSenderMessage, type MsgCtx, type Rule } from './util';

/**
 * IMPERSONATION means the sender claims to BE an organisation, not merely that one is mentioned.
 * "am platit prin Livrare Sigura" or "il vand pe PiataMea" mention a platform and must not fire.
 * A claim is one of: a self-introduction ("sunt de la ..."), "din partea ...", a role + organisation, a named service
 * ("suportul tehnic"), a message that opens with "<Org>:" or "<Org> va informeaza ...".
 */
const GENERIC_ORG = String.raw`(?:banc\w*|politi\w*|parchet\w*|anaf|fisc\w*|curier\w*|microsoft|windows|apple|google|dna|dnsc|dgaspc|dgpci|casa (?:nationala )?de pensii|casei (?:nationale )?de pensii|casa de asigurari\w*|ministerul\w*|primaria|primariei|prefectura|inspectorat\w*|operator\w*|furnizor\w*|serviciul|departamentul|institutia|posta romana|ghiseul)`;
const AUTHORITY = String.raw`(?:casa (?:nationala )?de pensii|casei de pensii|politia(?: romana| rutiera)?|ministerul\w*(?: \w+)?|dgaspc|primaria|prefectura|parchetul|fiscul|dna|dnsc|microsoft|windows|operatorul(?: de telefonie| dumneavoastra| dvs)?|furnizorul de (?:energie|internet|gaze|telefonie))`;
const ANNOUNCE = String.raw`(?:va\s+)?(?:informeaza|anunta|contacteaza|notifica|solicita|invita|comunica|cere|someaza|convoaca)`;

const GENERIC_RE = new RegExp(
  [
    String.raw`\b(?:sunt|suntem|ma numesc|va (?:suna|contacteaza|scrie|apelez|contactez)|va apelam)\b[^!?;\n]{0,50}\b(?:de la|din partea|reprezentant\w*|lucrez la|lucrez pentru)\s+(?:de\s+)?${GENERIC_ORG}\b`,
    String.raw`\b(?:din partea|in numele|din numele)\s+(?:de\s+)?${GENERIC_ORG}\b`,
    // First-person role claims only. "nici angajatilor bancii" is a warning ABOUT bank staff, not a claim to be one.
    String.raw`\b(?:sunt|suntem)\b[^!?;\n]{0,25}\b(?:agent|ofiter|procuror|inspector|consilier|reprezentant|angajat|operator|colonel|comisar|specialist|tehnician|inginer)\b[^!?;\n]{0,30}\b${GENERIC_ORG}\b`,
    String.raw`\b(?:agent|ofiter|procuror|inspector|comisar|colonel)\b(?: \w+){0,2}\s+(?:de la|din)\s+${GENERIC_ORG}\b`,
    String.raw`\b(?:suportul|serviciul|echipa|departamentul|centrul|biroul)\s+(?:de\s+)?(?:suport\s+)?(?:tehnic|securitate|fraude|clienti|relatii cu clientii)\w*`,
    String.raw`^[^a-z0-9]{0,6}${AUTHORITY}\b[^\n:]{0,25}:`,
    String.raw`\b${AUTHORITY}\b[^.!?;\n]{0,15}\b${ANNOUNCE}\b`,
  ].join('|'),
  'g',
);

const claimRegexes = new Map<Org, RegExp>(
  ORGS.map((o) => [
    o,
    new RegExp(
      [
        String.raw`^[^a-z0-9]{0,6}${o.nameSrc}\b[^\n:]{0,12}[:,!-]`,
        String.raw`\b${o.nameSrc}\b[^.!?;\n]{0,15}\b(?:va\s+)?(?:informeaza|anunta|contacteaza|notifica|solicita|invita|comunica|multumeste|reaminteste)\b`,
        String.raw`\b(?:sunt|suntem|ma numesc|va (?:suna|contactez|scriu|apelez)|va apelam)\b[^.!?;\n]{0,50}\b(?:de la|din partea|reprezentant\w*|lucrez la|lucrez pentru)\s+${o.nameSrc}\b`,
        String.raw`\b(?:din partea|in numele|echipa|departamentul|serviciul)\s+(?:de\s+)?${o.nameSrc}\b`,
      ].join('|'),
    ),
  ]),
);

/** Catalog organisations the message claims to BE (identity claim), as opposed to merely naming. */
export function claimedAsIdentity(norm: string): Org[] {
  return ORGS.filter((o) => claimRegexes.get(o)?.test(norm) === true);
}

const isPhoneNumber = (address: string | null): boolean => address !== null && /^[+\d\s().-]+$/.test(address) && address.replace(/\D/g, '').length >= 9;

/** True when the sender id itself names the organisation (alphanumeric sender "MegaShop", or its official domain). */
function senderIsOrg(s: Scenario['sender'], org: Org): boolean {
  const id = normalizeText(`${s.name ?? ''} ${s.address ?? ''}`);
  if (org.nameRe.test(id)) return true;
  const domain = (s.address ?? '').toLowerCase().slice((s.address ?? '').lastIndexOf('@') + 1);
  return s.address?.includes('@') === true && (domain === org.site || domain.endsWith(`.${org.site}`));
}

/**
 * Fires on a generic claim (any sender can say "sunt de la Politie"), or when a catalog organisation is claimed AND
 * either its contact details are off in that message, or the claim comes from an unknown phone number whose sender
 * name does not match (a shop "texting" from a private mobile with no link to check).
 */
export const impersonation: Rule = (c) => {
  const contactMessages = new Set(suspiciousContact(c).map((h) => h.msg));
  const { sender } = c.scenario;
  return perSenderMessage(c, (m: MsgCtx): Hit | null => {
    const generic = firstHit('RF_IMPERSONATION', m, GENERIC_RE);
    if (generic) return generic;
    const orgs = claimedAsIdentity(m.norm);
    const first = orgs[0];
    if (!first) return null;
    const unknownNumber = !sender.known_contact && isPhoneNumber(sender.address) && orgs.some((o) => !senderIsOrg(sender, o));
    if (!contactMessages.has(m.n) && !unknownNumber) return null;
    return { flag: 'RF_IMPERSONATION', msg: m.n, evidence: first.name, src: 'rule' };
  });
};

/** The catalog organisation the thread impersonates, if any (null for generic or non-catalog claims). */
export function impersonatedOrg(s: Scenario, hits: Hit[]): string | null {
  const flagged = new Set(hits.filter((h) => h.flag === 'RF_IMPERSONATION').map((h) => h.msg));
  for (const m of buildCtx(s).msgs) {
    if (m.from !== 'sender' || !flagged.has(m.n)) continue;
    const org = claimedAsIdentity(m.norm)[0];
    if (org) return org.name;
  }
  return null;
}
