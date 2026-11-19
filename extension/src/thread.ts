import type { Scenario } from '@ss/contracts';

/** One bubble as read from WhatsApp Web, before it becomes a Scenario message. */
export interface RawMessage {
  /** true for the reader's own bubbles (WhatsApp "message-out"). */
  outgoing: boolean;
  text: string;
}

/**
 * Brief threads run up to about ten messages, and the hook sits near the end. Older history only adds noise
 * and embedding time, so only the latest messages are judged.
 */
export const MAX_MESSAGES = 20;

/** A chat title that is a phone number means the sender is not in the reader's contacts. */
export function isPhoneTitle(title: string): boolean {
  return /^[+\d\s().-]+$/.test(title) && title.replace(/\D/g, '').length >= 9;
}

/** The open chat as a Scenario: incoming bubbles are the sender, the reader's own bubbles are the reader. */
export function toScenario(title: string, raw: RawMessage[]): Scenario {
  const recent = raw.filter((m) => m.text.trim() !== '').slice(-MAX_MESSAGES);
  const phone = isPhoneTitle(title);
  return {
    id: 'WhatsApp',
    channel: 'whatsapp',
    sender: { name: phone ? null : title || null, address: phone ? title : null, known_contact: !phone && title !== '' },
    messages: recent.map((m, i) => ({ n: i + 1, from: m.outgoing ? 'reader' : 'sender', text: m.text })),
  };
}

/**
 * FNV-1a over the thread. It is used to skip re-analysis when nothing changed and to key notifications,
 * so message text itself is never kept.
 */
export function threadKey(title: string, raw: RawMessage[]): string {
  let h = 0x811c9dc5;
  const s = `${title}\u0000${raw.map((m) => `${m.outgoing ? 1 : 0}${m.text}`).join('\u0000')}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
