import { describe, expect, it } from 'vitest';
import { readChat, type ElLike, type RootLike } from './dom';

/** A minimal fake of a WhatsApp Web bubble: only what readChat touches. */
function bubble(text: string, outgoing: boolean): ElLike {
  const span: ElLike = { getAttribute: () => null, closest: () => null, querySelector: () => null, textContent: text };
  return {
    getAttribute: (n) => (n === 'data-pre-plain-text' ? '[13:05, 19.11.2026] X: ' : null),
    closest: (sel) => (sel === '.message-out' && outgoing ? span : null),
    querySelector: (sel) => (sel === 'span.selectable-text' ? span : null),
    textContent: text,
  };
}

function root(title: string | null, bubbles: ElLike[]): RootLike {
  const header: ElLike | null =
    title === null ? null : { getAttribute: (n) => (n === 'title' ? title : null), closest: () => null, querySelector: () => null, textContent: title };
  return {
    querySelector: (sel) => (sel.startsWith('#main header') ? header : null),
    querySelectorAll: (sel) => (sel === '#main [data-pre-plain-text]' ? bubbles : []),
  };
}

describe('readChat', () => {
  it('returns null when no chat is open', () => {
    expect(readChat(root(null, []))).toBeNull();
  });
  it('reads title, direction and text, skipping empty bubbles', () => {
    const chat = readChat(root('+40 721 555 000', [bubble('Bună!', false), bubble('  ', false), bubble('Cine e?', true)]));
    expect(chat?.title).toBe('+40 721 555 000');
    expect(chat?.messages).toEqual([
      { outgoing: false, text: 'Bună!' },
      { outgoing: true, text: 'Cine e?' },
    ]);
    expect(chat?.bubbles).toHaveLength(2);
  });
});
