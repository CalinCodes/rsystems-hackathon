import type { FlagCode, ScamType } from '@ss/contracts';

export interface WarningEntry {
  ro: string;
  en: string;
  action: string;
}

export type TypeTexts = { action_fallback: string; _default: WarningEntry } & Partial<Record<FlagCode, WarningEntry>>;

export interface WarningTexts {
  lead: Record<'SCAM' | 'SUSPICIOUS', string>;
  lead_en: Record<'SCAM' | 'SUSPICIOUS', string>;
  types: Record<ScamType, TypeTexts>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Reshape the parsed warnings.yaml (types at top level) into the engine's lookup shape. */
export function toWarningTexts(doc: unknown): WarningTexts {
  if (!isObj(doc) || !isObj(doc.lead) || !isObj(doc.lead_en)) throw new Error('warnings.yaml: missing lead');
  const { lead, lead_en, ...types } = doc;
  return {
    lead: lead as WarningTexts['lead'],
    lead_en: lead_en as WarningTexts['lead_en'],
    types: types as WarningTexts['types'],
  };
}
