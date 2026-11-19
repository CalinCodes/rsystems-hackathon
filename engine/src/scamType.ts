import type { FlagCode, Hit, ScamType, Scenario } from '@ss/contracts';
import { normalizeText } from './normalize';
import { claimedSites } from './rules/contact';

interface TypeCtx {
  flags: Set<FlagCode>;
  /** Everything the sender wrote, normalized. */
  text: string;
  sites: Set<string>;
}

const has = (c: TypeCtx, ...f: FlagCode[]): boolean => f.some((x) => c.flags.has(x));
const words = (c: TypeCtx, re: RegExp): boolean => re.test(c.text);

const TECH = /\b(?:virus\w*|windows|microsoft|calculator\w*|suportul? tehnic|licenta|infectat\w*|router\w*)\b/;
const FAMILY = /\b(?:mama|mamico|tata|tati|fiul|fiica|bunica|bunicul|nepot\w*|draga mamei|copil\w*)\b/;
const PRIZE = /\b(?:castigat\w*|premiu\w*|voucher\w*|loterie|tombola|cadou\w*|tragere)\b/;
const COURIER = /\b(?:colet\w*|livrare|curier\w*|awb|vama|expeditie)\b/;
// Selling context. Checked BEFORE courier: "Livrare Sigura" is a marketplace feature, not a courier fee.
const MARKET = /\b(?:disponibil\w*|anunt\w*|cumpar\w*|o iau|vand\w*|vanzator\w*|cumparator\w*|avans|produsul|pret\w*|negociabil|olx|piatamea|livrare sigura)\b/;
const AUTHORITY = /\b(?:politi\w*|parchet\w*|procuror\w*|anaf|dna|amenda|executor\w*|instanta|inspector\w*|fisc\w*|casa (?:nationala )?de pensii|casei de pensii|pensi\w*|ministerul\w*|dgaspc|primaria|prefectura)\b/;
const TAKEOVER = /\b(?:whatsapp|facebook|instagram|telegram|din greseala|verificare|contul tau|contul dvs)\b/;
const BANK = /\b(?:banca|bancar\w*|card\w*|tranzactie\w*|3d ?secure|internet banking)\b/;
const INVEST = /\b(?:invest\w*|crypto|bitcoin|trading|forex|broker\w*|randament|dobanda|actiuni|portofel)\b/;
const ROMANCE = /\b(?:te iubesc|dragoste|suflet\w*|relatie|ne intalnim|bilet de avion|militar|platforma petroliera)\b/;
const JOB = /\b(?:job|angajare|angajam|salariu|recrut\w*|interviu|post vacant|comision|munca)\b/;

/**
 * Ordered decision list: first rule that fires wins, so put the most specific signals first.
 * WHY a list and not scores: each branch is one readable sentence a teammate can tune without retraining anything.
 */
const DECISIONS: [ScamType, (c: TypeCtx) => boolean][] = [
  // Tech-support wording (virus, Windows, support team) with a claim or a scare is enough; remote access is not required.
  ['TECH_SUPPORT', (c) => words(c, TECH) && has(c, 'RF_REMOTE_ACCESS', 'RF_IMPERSONATION', 'RF_THREAT')],
  ['FAMILY_EMERGENCY', (c) => has(c, 'RF_NEW_NUMBER') || (words(c, FAMILY) && has(c, 'RF_PAYMENT_REQUEST', 'RF_EMOTIONAL_PRESSURE'))],
  ['PRIZE_LOTTERY', (c) => words(c, PRIZE) && has(c, 'RF_TOO_GOOD', 'RF_PAYMENT_REQUEST', 'RF_SUSPICIOUS_CONTACT')],
  ['MARKETPLACE', (c) => (c.sites.has('piatamea.ro') || words(c, MARKET)) && has(c, 'RF_PAYMENT_REQUEST', 'RF_SUSPICIOUS_CONTACT', 'RF_CHANNEL_SWITCH', 'RF_DATA_REQUEST', 'RF_CODE_REQUEST')],
  ['COURIER_FEE', (c) => (c.sites.has('curierexpres.ro') || words(c, COURIER)) && has(c, 'RF_PAYMENT_REQUEST', 'RF_SUSPICIOUS_CONTACT', 'RF_DATA_REQUEST')],
  ['AUTHORITY_IMPERSONATION', (c) => (c.sites.has('anaf.ro') || words(c, AUTHORITY)) && has(c, 'RF_IMPERSONATION', 'RF_THREAT', 'RF_PAYMENT_REQUEST', 'RF_DATA_REQUEST')],
  ['ACCOUNT_TAKEOVER', (c) => has(c, 'RF_CODE_REQUEST') && !c.sites.has('bancadunarea.ro') && words(c, TAKEOVER)],
  ['BANK_IMPERSONATION', (c) => (c.sites.has('bancadunarea.ro') || words(c, BANK)) && has(c, 'RF_SUSPICIOUS_CONTACT', 'RF_CODE_REQUEST', 'RF_DATA_REQUEST', 'RF_THREAT', 'RF_IMPERSONATION', 'RF_REMOTE_ACCESS')],
  ['INVESTMENT', (c) => words(c, INVEST) && has(c, 'RF_TOO_GOOD', 'RF_PAYMENT_REQUEST', 'RF_URGENCY')],
  ['ROMANCE', (c) => words(c, ROMANCE) && has(c, 'RF_EMOTIONAL_PRESSURE', 'RF_PAYMENT_REQUEST', 'RF_CHANNEL_SWITCH')],
  ['JOB_OFFER', (c) => words(c, JOB) && has(c, 'RF_TOO_GOOD', 'RF_PAYMENT_REQUEST', 'RF_CHANNEL_SWITCH', 'RF_DATA_REQUEST')],
  ['TECH_SUPPORT', (c) => has(c, 'RF_REMOTE_ACCESS')],
];

/** SAFE threads have no scam type by definition; anything flagged but unmatched is OTHER. */
export function decideType(s: Scenario, hits: Hit[], isSafe: boolean): ScamType {
  if (isSafe) return 'NONE';
  const text = s.messages.filter((m) => m.from === 'sender').map((m) => normalizeText(m.text)).join(' \n ');
  const sites = new Set(claimedSites(`${normalizeText(`${s.sender.name ?? ''} ${s.sender.address ?? ''}`)} ${text}`));
  const ctx: TypeCtx = { flags: new Set(hits.map((h) => h.flag)), text, sites };
  return DECISIONS.find(([, test]) => test(ctx))?.[0] ?? 'OTHER';
}
