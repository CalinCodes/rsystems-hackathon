import type { Result } from '@ss/contracts';
import { bannerModel } from './banner';
import { readChat, type ElLike } from './dom';
import { threadKey, toScenario } from './thread';
import { renderBanner, markFirstAlert } from './view';

// Runs inside web.whatsapp.com. It reads only the chat that is open on screen, sends it to the extension's
// own service worker for analysis, and draws the result. Nothing is stored and nothing goes to a server.
const DEBOUNCE_MS = 800;
let lastThread = '';
let dismissed = '';
let timer: ReturnType<typeof setTimeout> | undefined;

async function check(): Promise<void> {
  const chat = readChat(document as unknown as Parameters<typeof readChat>[0]);
  if (chat === null || chat.messages.length === 0) return renderBanner(null, () => undefined);
  const thread = threadKey(chat.title, chat.messages);
  if (thread === lastThread) return;
  lastThread = thread;
  const scenario = toScenario(chat.title, chat.messages);
  const chatKey = threadKey(chat.title, []);
  const r = await chrome.runtime.sendMessage<Result | null>({ type: 'ss-analyze', chat: chatKey, scenario });
  if (r === null || thread !== lastThread) return; // a newer read superseded this one
  const model = bannerModel(r);
  const key = `${chatKey}:${r.verdict}`;
  renderBanner(dismissed === key ? null : model, () => {
    dismissed = key;
  });
  // Scenario keeps only the latest MAX_MESSAGES bubbles, so message n maps to the tail of the bubble list.
  const offset = chat.bubbles.length - scenario.messages.length;
  const bubble: ElLike | undefined = r.firstAlert === null ? undefined : chat.bubbles[offset + r.firstAlert - 1];
  markFirstAlert(model === null ? undefined : (bubble as unknown as HTMLElement | undefined));
}

new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => void check().catch(() => undefined), DEBOUNCE_MS);
}).observe(document.body, { childList: true, subtree: true, characterData: true });
