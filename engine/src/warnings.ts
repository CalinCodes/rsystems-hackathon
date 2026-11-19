import type { FlagCode, Hit, Result } from '@ss/contracts';
import { ALL_FLAGS, FLAG_POINTS } from '@ss/contracts';
import catalog from '@ss/contracts/catalog.json';
import type { WarningTexts } from './warningTexts';
import texts from './warningTexts.json';

const TEXTS = texts as WarningTexts;
const PLACEHOLDER = '{official_contact}';
const digits = (s: string): string => s.replace(/\D/g, '');

export interface WarningContext {
  /** Catalog organisation being impersonated (impersonatedOrg), or null. */
  org: string | null;
  /** All message text of the thread, used only to make sure we never echo one of its numbers. */
  threadText: string;
}

/** Highest-points flag that has its own text for this type; ties follow ALL_FLAGS order. */
export function strongestFlag(hits: Hit[], has: (f: FlagCode) => boolean): FlagCode | null {
  const found = new Set(hits.map((h) => h.flag));
  const ranked = ALL_FLAGS.filter((f) => found.has(f) && has(f));
  ranked.sort((a, b) => FLAG_POINTS[b] - FLAG_POINTS[a]);
  return ranked[0] ?? null;
}

/**
 * Put the impersonated org's catalog phone into the action. Falls back to the type's generic action
 * when there is no org or no phone, or when that number already appears in the message: the warning
 * must never repeat a number from the message, even an official one a scammer quoted.
 */
export function fillAction(action: string, fallback: string, ctx: WarningContext): string {
  if (!action.includes(PLACEHOLDER)) return action;
  const phone = catalog.organisations.find((o) => o.name === ctx.org)?.phone ?? null;
  if (phone === null || digits(ctx.threadText).includes(digits(phone))) return fallback;
  return action.replace(PLACEHOLDER, phone);
}

type Scored = Pick<Result, 'verdict' | 'scamType' | 'hits'>;

/** Lead (by verdict) + one sentence on what and why + one action: at most three short sentences. */
export function buildWarning(r: Scored, ctx: WarningContext): Result['warning'] {
  const safe = r.verdict === 'SAFE';
  // A non-SAFE verdict needs a real warning even if no type matched.
  const type = safe ? 'NONE' : r.scamType === 'NONE' ? 'OTHER' : r.scamType;
  const block = TEXTS.types[type];
  const flag = strongestFlag(r.hits, (f) => block[f] !== undefined);
  const entry = (flag !== null ? block[flag] : undefined) ?? block._default;
  const join = (lead: string | undefined, body: string): string => (lead ? `${lead} ${body}` : body);
  const leadKey = safe ? null : r.verdict === 'SCAM' ? 'SCAM' : 'SUSPICIOUS';
  return {
    ro: join(leadKey ? TEXTS.lead[leadKey] : undefined, entry.ro),
    en: join(leadKey ? TEXTS.lead_en[leadKey] : undefined, entry.en),
    action: fillAction(entry.action, block.action_fallback, ctx),
  };
}
