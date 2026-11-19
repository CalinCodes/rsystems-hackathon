import type { Result, Scenario } from '@ss/contracts';

export interface BannerModel {
  tone: 'scam' | 'suspicious' | 'info';
  icon: string;
  /** The big first line: the verdict in words, so colour is never the only signal. */
  headline: string;
  body: string;
  /** Shown under the body when the sender is not a saved contact. */
  note: string | null;
  action: string;
  /** Plain-language note on what judged the chat, for the jury's "does anything leave the laptop?". */
  footer: string;
}

const UNKNOWN_NOTE = 'Numărul nu este în agenda dumneavoastră.';
// A saved contact asking for data or a code is usually a hacked account. The one useful step is to call that person
// on the number already saved, not "the company's site" or "the number on the card".
const KNOWN_CONTACT_ACTION = 'Nu trimiteți nimic și sunați persoana la numărul pe care îl aveți deja salvat.';
const HACKED_CONTACT_TYPES = new Set(['OTHER', 'ACCOUNT_TAKEOVER']);

/** Same words as the engine's lead sentence and the brief's verdict labels. */
const HEADLINE: Record<BannerModel['tone'], string> = {
  scam: 'Atenție, pare o țeapă!',
  suspicious: 'Atenție, verificați înainte să răspundeți.',
  info: 'Număr necunoscut',
};

/** The engine's warning starts with the same lead; drop it from the body so the reader never reads it twice. */
export function stripLead(text: string, headline: string): string {
  return text.startsWith(headline) ? text.slice(headline.length).trim() : text;
}

/** What "Ascultați" reads: the whole banner, in reading order, without the footer. */
export function spokenText(m: BannerModel): string {
  return [m.headline, m.body, m.note, `Ce să faceți: ${m.action}`].filter((x) => x !== null && x !== '').join(' ');
}

/** Same signature = same banner on screen, so a new harmless message does not redraw or re-animate it. */
export const bannerSignature = (m: BannerModel): string => `${m.tone}|${m.body}|${m.note ?? ''}|${m.action}`;

/** Unknown = WhatsApp shows a phone number, not a saved name. */
export const isUnknownSender = (s: Scenario): boolean => !s.sender.known_contact && s.sender.address !== null;

/**
 * A safe chat from a saved contact shows nothing: a banner on every normal chat would teach people to ignore it.
 * A safe chat from an unknown number gets a calm grey note only (no badge, no notification), because that is
 * where most scams start.
 */
export function bannerModel(r: Result, s: Scenario): BannerModel | null {
  const unknown = isUnknownSender(s);
  const modelOn = r.timingsMs.clfUnavailable !== 1;
  const footer = `Verificat pe acest calculator${modelOn ? ', cu reguli și model AI local' : ', cu reguli'}. Mesajele nu pleacă nicăieri.`;
  if (r.verdict === 'SAFE') {
    if (!unknown) return null;
    return {
      tone: 'info',
      icon: 'ℹ️',
      headline: HEADLINE.info,
      body: 'Vă scrie un număr necunoscut, care nu este în agenda dumneavoastră.',
      note: null,
      action: 'Nu trimiteți bani, coduri sau date până nu aflați sigur cine este.',
      footer,
    };
  }
  const tone = r.verdict === 'SCAM' ? 'scam' : 'suspicious';
  return {
    tone,
    icon: r.verdict === 'SCAM' ? '⛔' : '⚠️',
    headline: HEADLINE[tone],
    body: stripLead(r.warning.ro, HEADLINE[tone]),
    note: unknown ? UNKNOWN_NOTE : null,
    action: s.sender.known_contact && HACKED_CONTACT_TYPES.has(r.scamType) ? KNOWN_CONTACT_ACTION : r.warning.action,
    footer,
  };
}

/** Notify once per (chat, verdict): a new message that keeps the same verdict must not ring again. */
export function shouldNotify(last: string | undefined, chat: string, r: Result): boolean {
  return r.verdict !== 'SAFE' && last !== `${chat}:${r.verdict}`;
}
