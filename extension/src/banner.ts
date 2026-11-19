import type { Result } from '@ss/contracts';

export interface BannerModel {
  tone: 'scam' | 'suspicious';
  icon: string;
  body: string;
  action: string;
  /** Plain-language note on what judged the chat, for the jury's "does anything leave the laptop?". */
  footer: string;
}

/** SAFE shows nothing: a banner on every normal chat would teach people to ignore it. */
export function bannerModel(r: Result): BannerModel | null {
  if (r.verdict === 'SAFE') return null;
  const modelOn = r.timingsMs.clfUnavailable !== 1 && r.timingsMs.clf !== undefined;
  return {
    tone: r.verdict === 'SCAM' ? 'scam' : 'suspicious',
    icon: r.verdict === 'SCAM' ? '⛔' : '⚠️',
    body: r.warning.ro,
    action: r.warning.action,
    footer: `Verificat pe acest calculator${modelOn ? ', cu reguli și model AI local' : ', cu reguli'}. Mesajele nu pleacă nicăieri.`,
  };
}

/** Notify once per (chat, verdict): a new message that keeps the same verdict must not ring again. */
export function shouldNotify(last: string | undefined, chat: string, r: Result): boolean {
  return r.verdict !== 'SAFE' && last !== `${chat}:${r.verdict}`;
}
