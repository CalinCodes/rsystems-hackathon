import type { Result, ScamType } from '@ss/contracts';

/**
 * Pager: one ntfy alert to a trusted family member when the reader gets a SCAM warning.
 *
 * Privacy: the alert carries the reader's name (typed by them in the options page), the scam type in plain words
 * and the time. NEVER message text, the sender's number or the chat name: the family member only needs to know
 * "call her now", not what was written.
 */
export interface PagerConfig {
  enabled: boolean;
  /** ntfy server on the same network, e.g. http://192.168.1.20:8090 */
  server: string;
  topic: string;
  /** How the family member knows the reader, e.g. "Mama". */
  name: string;
}

export const EMPTY_PAGER: PagerConfig = { enabled: false, server: '', topic: '', name: '' };

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

/** Only private-network hosts: the alert must never leave the local network (no ntfy.sh, no public server). */
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
    url = new URL(c.server.trim());
  } catch {
    return { problem: 'server' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { problem: 'server' };
  if (!isLocalHost(url.hostname)) return { problem: 'not_local' };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(c.topic.trim())) return { problem: 'topic' };
  if (c.name.trim() === '' || c.name.length > 40) return { problem: 'name' };
  return { origin: url.origin };
}

/** Page once per chat: further messages in the same scam chat must not ring the family member again. */
export function shouldPage(paged: Set<string>, chat: string, r: Result): boolean {
  return r.verdict === 'SCAM' && !paged.has(chat);
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
      priority: 3,
      tags: ['white_check_mark'],
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
