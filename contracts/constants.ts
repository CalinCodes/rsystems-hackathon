import type { FlagCode, Verdict } from './types';

export const POINTS = {
  CODE: 35,
  REMOTE: 35,
  DATA: 30,
  PAYMENT: 25,
  SUSPICIOUS_CONTACT: 25,
  NEW_NUMBER: 20,
  SECRECY: 20,
  TOO_GOOD: 20,
  IMPERSONATION: 15,
  URGENCY: 15,
  THREAT: 15,
  EMOTIONAL: 10,
  CHANNEL_SWITCH: 10,
} as const;

/** Every flag with its points; Record type forces a new FlagCode to get a score. */
export const FLAG_POINTS: Record<FlagCode, number> = {
  RF_CODE_REQUEST: POINTS.CODE,
  RF_REMOTE_ACCESS: POINTS.REMOTE,
  RF_DATA_REQUEST: POINTS.DATA,
  RF_PAYMENT_REQUEST: POINTS.PAYMENT,
  RF_SUSPICIOUS_CONTACT: POINTS.SUSPICIOUS_CONTACT,
  RF_NEW_NUMBER: POINTS.NEW_NUMBER,
  RF_SECRECY: POINTS.SECRECY,
  RF_TOO_GOOD: POINTS.TOO_GOOD,
  RF_IMPERSONATION: POINTS.IMPERSONATION,
  RF_URGENCY: POINTS.URGENCY,
  RF_THREAT: POINTS.THREAT,
  RF_EMOTIONAL_PRESSURE: POINTS.EMOTIONAL,
  RF_CHANNEL_SWITCH: POINTS.CHANNEL_SWITCH,
};

export const ALL_FLAGS = Object.keys(FLAG_POINTS) as FlagCode[];

export const ALERT_THRESHOLD = 25;
export const SCORE_CAP = 100;
export const EMBED_MODEL = 'bge-m3';

export function verdictFor(score: number): Verdict {
  if (score >= 50) return 'SCAM';
  if (score >= ALERT_THRESHOLD) return 'SUSPICIOUS';
  return 'SAFE';
}
