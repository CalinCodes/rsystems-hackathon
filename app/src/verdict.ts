import type { Verdict } from '@ss/contracts';

export interface VerdictLook {
  icon: string;
  word: string;
  /** Tailwind classes for the border + accent text of this verdict. */
  cls: string;
}

// Texts are the brief's exact wording. Icons double the colour so the verdict
// reads without relying on colour alone (accessibility for elderly / colour-blind users).
export const VERDICT_LOOK: Record<Verdict, VerdictLook> = {
  SAFE: { icon: '✓', word: 'Pare în regulă', cls: 'text-safe border-safe' },
  SUSPICIOUS: {
    icon: '⚠',
    word: 'Atenție, verificați înainte să răspundeți',
    cls: 'text-suspicious border-suspicious',
  },
  SCAM: { icon: '⛔', word: 'Pare o țeapă! Nu răspundeți', cls: 'text-scam border-scam' },
};

/** Romanian display name for each scam type, for the plain-language summary line. */
export const SCAM_TYPE_RO: Record<string, string> = {
  BANK_IMPERSONATION: 'Bancă falsă',
  COURIER_FEE: 'Taxă colet',
  AUTHORITY_IMPERSONATION: 'Autoritate falsă',
  FAMILY_EMERGENCY: 'Urgență în familie',
  TECH_SUPPORT: 'Suport tehnic fals',
  MARKETPLACE: 'Vânzare online',
  ACCOUNT_TAKEOVER: 'Preluare cont',
  INVESTMENT: 'Investiție falsă',
  ROMANCE: 'Înșelătorie sentimentală',
  JOB_OFFER: 'Loc de muncă fals',
  PRIZE_LOTTERY: 'Premiu fals',
  OTHER: 'Altă înșelătorie',
  NONE: 'Niciun pericol',
};

export function scamTypeLabel(type: string): string {
  return SCAM_TYPE_RO[type] ?? type;
}
