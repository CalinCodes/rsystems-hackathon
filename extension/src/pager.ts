import type { Result, ScamType } from '@ss/contracts';

/**
 * Pager: one ntfy alert to a trusted family member when the reader gets a SCAM warning.
 *
 * Privacy: the alert carries the reader's name (typed by them in the options page), the scam type in plain words
 * and the time. NEVER message text, the sender's number or the chat name: the family member only needs to know
 * "call her now", not what was written. This matters because the default server is the public ntfy.sh: the alert
 * crosses the internet, and anyone who knows the topic can read it.
 */
export interface PagerConfig {
  enabled: boolean;
  /** https://ntfy.sh (default), or a self-hosted ntfy server on the local network. */
  server: string;
  topic: string;
  /** How the family member knows the reader, e.g. "Mama". */
  name: string;
}

export const PUBLIC_NTFY = 'https://ntfy.sh';
export const DEFAULT_TOPIC = 'scamshield-family-676767';
export const EMPTY_PAGER: PagerConfig = { enabled: false, server: PUBLIC_NTFY, topic: DEFAULT_TOPIC, name: '' };

const TYPE_RO: Record<ScamType, string> = {
  BANK_IMPERSONATION: 'bancă falsă',
  COURIER_FEE: 'taxă falsă pentru colet',
  AUTHORITY_IMPERSONATION: 'autoritate falsă',
  FAMILY_EMERGENCY: 'rudă falsă care cere bani',
  TECH_SUPPORT: 'suport tehnic fals',
  MARKETPLACE: 'cumpărător fals',
  ACCOUNT_TAKEOVER: 'furt de cont',
  INVESTMENT: 'investiție falsă',
  ROMANCE: 'înșelătorie sentimentală',
  JOB_OFFER: 'loc de muncă fals',
  PRIZE_LOTTERY: 'premiu fals',
  OTHER: 'înșelătorie',
  NONE: 'înșelătorie',
};

/** Private-network hosts (a self-hosted ntfy server at home). */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local')) return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  if (ip.slice(1).some((x) => Number(x) > 255)) return false;
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

export type PagerProblem = 'server' | 'not_local' | 'topic' | 'name';

/** Validated origin of the server, or the first problem with the config. */
export function checkConfig(c: PagerConfig): { origin: string } | { problem: PagerProblem } {
  let url: URL;
  try {
    url = new URL(c.server.trim() === '' ? PUBLIC_NTFY : c.server.trim());
  } catch {
    return { problem: 'server' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { problem: 'server' };
  // Allowed: the public ntfy.sh over https, or a local server. Any other public host is refused, so a typo or a
  // look-alike domain can never receive the alerts.
  const publicNtfy = url.protocol === 'https:' && url.hostname === 'ntfy.sh' && url.port === '';
  if (!publicNtfy && !isLocalHost(url.hostname)) return { problem: 'not_local' };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(c.topic.trim())) return { problem: 'topic' };
  if (c.name.trim() === '' || c.name.length > 40) return { problem: 'name' };
  return { origin: url.origin };
}

/** After an alert for a chat, wait this long before that chat can ring the family phone again. */
export const COOLDOWN_MS = 2 * 60_000;

/** What we remember per chat: when it last paged and which message triggered it. Hashes and times only. */
export interface PageMark {
  at: number;
  msg: string;
}

export type PageDecision = 'page' | 'not_scam' | 'not_new' | 'cooldown';

/**
 * Page when the chat is SCAM and a NEW message arrived since the last alert, at most once per COOLDOWN_MS.
 * - "new message": reopening the chat or WhatsApp re-rendering the same bubbles must not ring again;
 * - cooldown: a scammer sending ten messages in a row rings once, but a fresh scam a few minutes later rings again.
 * The mark lives in chrome.storage.session, so a service-worker restart does not reset it (that used to make
 * alerts look random: sometimes repeated, sometimes missing).
 */
export function decidePage(mark: PageMark | undefined, r: Pick<Result, 'verdict'>, lastMsg: string, now: number): PageDecision {
  if (r.verdict !== 'SCAM') return 'not_scam';
  if (mark === undefined) return 'page';
  if (mark.msg === lastMsg) return 'not_new';
  if (now - mark.at < COOLDOWN_MS) return 'cooldown';
  return 'page';
}

export type AlertStep = { send: true } | { send: false; skipped: 'disabled' | PagerProblem | null };

/**
 * Full decision for one analysis. skipped = null: nothing to report (not a scam, already paged, cooldown).
 * skipped = a reason: a scam that SHOULD have paged, but the settings stop it; the options page shows why.
 */
export function decideAlert(cfg: PagerConfig, mark: PageMark | undefined, r: Pick<Result, 'verdict'>, lastMsg: string, now: number): AlertStep {
  if (decidePage(mark, r, lastMsg, now) !== 'page') return { send: false, skipped: null };
  if (!cfg.enabled) return { send: false, skipped: 'disabled' };
  const checked = checkConfig(cfg);
  return 'problem' in checked ? { send: false, skipped: checked.problem } : { send: true };
}

const hhmm = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** ntfy JSON publish body (JSON, not headers: header values cannot carry Romanian diacritics). */
export function pagerPayload(c: PagerConfig, r: Pick<Result, 'scamType'>, now: Date, test = false): Record<string, unknown> {
  const name = c.name.trim();
  if (test) {
    return {
      topic: c.topic.trim(),
      title: 'Scam Shield: test',
      message: `Alertele pentru ${name} funcționează. Veți primi un mesaj aici dacă ${name} primește o țeapă pe WhatsApp.`,
      // Same priority as a real alert (5 = max): the test must ring exactly like the real thing, or a phone set up
      // to ring only on max priority would look fine in the test and stay silent on a real scam.
      priority: 5,
      tags: ['rotating_light'],
    };
  }
  return {
    topic: c.topic.trim(),
    title: `Scam Shield: ${name} a primit o posibilă țeapă`,
    message:
      `La ${hhmm(now)}, ${name} a primit pe WhatsApp un mesaj care pare o țeapă (${TYPE_RO[r.scamType]}). ` +
      `Sunați acum pe ${name} la numărul pe care îl aveți salvat și spuneți-i să nu trimită bani sau coduri.`,
    priority: 5,
    tags: ['rotating_light'],
  };
}

/** POST to the ntfy server root. Throws on network or HTTP error; the caller decides what to do. */
export async function sendPage(
  c: PagerConfig,
  r: Pick<Result, 'scamType'>,
  opts: { now?: Date; test?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const checked = checkConfig(c);
  if ('problem' in checked) throw new Error(`pager config: ${checked.problem}`);
  const res = await (opts.fetchImpl ?? fetch)(checked.origin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pagerPayload(c, r, opts.now ?? new Date(), opts.test === true)),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
}
