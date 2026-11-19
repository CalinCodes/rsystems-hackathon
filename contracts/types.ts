export type Channel = 'sms' | 'whatsapp' | 'email' | 'chat' | 'call_transcript';

export type FlagCode =
  | 'RF_CODE_REQUEST'
  | 'RF_REMOTE_ACCESS'
  | 'RF_DATA_REQUEST'
  | 'RF_PAYMENT_REQUEST'
  | 'RF_SUSPICIOUS_CONTACT'
  | 'RF_NEW_NUMBER'
  | 'RF_SECRECY'
  | 'RF_TOO_GOOD'
  | 'RF_IMPERSONATION'
  | 'RF_URGENCY'
  | 'RF_THREAT'
  | 'RF_EMOTIONAL_PRESSURE'
  | 'RF_CHANNEL_SWITCH';

export type ScamType =
  | 'BANK_IMPERSONATION'
  | 'COURIER_FEE'
  | 'AUTHORITY_IMPERSONATION'
  | 'FAMILY_EMERGENCY'
  | 'TECH_SUPPORT'
  | 'MARKETPLACE'
  | 'ACCOUNT_TAKEOVER'
  | 'INVESTMENT'
  | 'ROMANCE'
  | 'JOB_OFFER'
  | 'PRIZE_LOTTERY'
  | 'OTHER'
  | 'NONE';

export type Verdict = 'SAFE' | 'SUSPICIOUS' | 'SCAM';

export interface Scenario {
  id: string;
  channel: Channel;
  sender: { name: string | null; address: string | null; known_contact: boolean };
  messages: { n: number; from: 'sender' | 'reader'; text: string }[];
}

export interface Hit {
  flag: FlagCode;
  /** 1-based message number (matches Scenario.messages[].n) */
  msg: number;
  evidence: string;
  src: 'rule' | 'clf' | 'llm';
  p?: number;
}

export interface Result {
  id: string;
  verdict: Verdict;
  scamType: ScamType;
  score: number;
  firstAlert: number | null;
  /** cumulative score after each message */
  timeline: number[];
  hits: Hit[];
  warning: { ro: string; en: string; action: string };
  timingsMs: Record<string, number>;
}

export interface ExpectedRow {
  id: string;
  verdict: Verdict;
  scamType: ScamType;
  score: number;
  firstAlert: number | null;
  firstAlertWindow: [number, number] | null;
  flags: FlagCode[];
}

export interface Weights {
  model: string;
  dim: number;
  flags: Partial<Record<FlagCode, { w: number[]; b: number }>>;
  type: { classes: ScamType[]; W: number[][]; b: number[] } | null;
}
