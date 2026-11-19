import type { RawMessage } from './thread';

/** The slice of the DOM API we use, so the reader can be tested without a browser. */
export interface ElLike {
  getAttribute(name: string): string | null;
  closest(selector: string): ElLike | null;
  querySelector(selector: string): ElLike | null;
  textContent: string | null;
}
export interface RootLike {
  querySelector(selector: string): ElLike | null;
  querySelectorAll(selector: string): Iterable<ElLike>;
}

// WHY these selectors: WhatsApp Web's class names are generated and change often. `data-pre-plain-text`
// (author + time on every text bubble) and the message-in/out markers have stayed stable for years.
const BUBBLE = '#main [data-pre-plain-text]';
const TITLES = ['#main header span[title]', '#main header [title]'];

export interface ChatRead {
  title: string;
  messages: RawMessage[];
  bubbles: ElLike[];
}

/** The open chat, or null when no chat is open. bubbles[i] is the element of messages[i]. */
export function readChat(root: RootLike): ChatRead | null {
  const header = TITLES.map((s) => root.querySelector(s)).find((e) => e !== null) ?? null;
  const bubbles = [...root.querySelectorAll(BUBBLE)];
  if (header === null && bubbles.length === 0) return null;
  const messages: RawMessage[] = [];
  const kept: ElLike[] = [];
  for (const b of bubbles) {
    const text = (b.querySelector('span.selectable-text')?.textContent ?? b.textContent ?? '').trim();
    if (text === '') continue;
    messages.push({ outgoing: b.closest('.message-out') !== null, text });
    kept.push(b);
  }
  return { title: (header?.getAttribute('title') ?? '').trim(), messages, bubbles: kept };
}
