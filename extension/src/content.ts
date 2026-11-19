import type { Result } from '@ss/contracts';
import { bannerModel, type BannerModel } from './banner';
import { readChat, type ElLike } from './dom';
import { installGuard, type GuardState } from './guardView';
import { threadKey, toScenario } from './thread';
import { renderBanner, markFirstAlert, showMessage, type BannerHandlers } from './view';

// Runs inside web.whatsapp.com. It reads only the chat that is open on screen, sends it to the extension's
// own service worker for analysis, and draws the result. Nothing is stored and nothing goes to a server.
const DEBOUNCE_MS = 800;
/** A quiet chat produces no DOM changes, so a failed analysis schedules its own retry. */
const RETRY_MS = 3_000;
let lastThread = '';
let dismissed = '';
let timer: ReturnType<typeof setTimeout> | undefined;
/** Latest verdict per open chat, for the typing guard. Keyed by chat so a stale verdict never guards another chat. */
let guard: (GuardState & { chat: string }) | null = null;

const readDoc = (): ReturnType<typeof readChat> => readChat(document as unknown as Parameters<typeof readChat>[0]);
const NO_BANNER: BannerHandlers = { id: '', collapsed: false, onCollapse: () => undefined, onExpand: () => undefined };
// Chrome loads its voice list late; asking once now means "Ascultați" is ready by the first banner.
if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

async function check(): Promise<void> {
  const chat = readDoc();
  if (chat === null || chat.messages.length === 0) return renderBanner(null, NO_BANNER);
  const thread = threadKey(chat.title, chat.messages);
  if (thread === lastThread) return;
  lastThread = thread;
  const scenario = toScenario(chat.title, chat.messages);
  const chatKey = threadKey(chat.title, []);
  let r: Result | null = null;
  try {
    r = await chrome.runtime.sendMessage<Result | null>({ type: 'ss-analyze', chat: chatKey, scenario });
  } catch {
    r = null; // service worker was waking up or restarting
  }
  if (r === null) {
    // Forget this thread so the next page change retries it: otherwise one failed call skipped the chat for good.
    if (thread === lastThread) lastThread = '';
    clearTimeout(timer);
    timer = setTimeout(() => void check().catch(() => undefined), RETRY_MS);
    return;
  }
  if (thread !== lastThread) return; // a newer read superseded this one
  guard = { chat: chatKey, verdict: r.verdict, action: r.warning.action };
  const model = bannerModel(r, scenario);
  // Scenario keeps only the latest MAX_MESSAGES bubbles, so message n maps to the tail of the bubble list.
  const offset = chat.bubbles.length - scenario.messages.length;
  const raw: ElLike | undefined = r.firstAlert === null ? undefined : chat.bubbles[offset + r.firstAlert - 1];
  const bubble = model === null || model.tone === 'info' ? undefined : (raw as unknown as HTMLElement | undefined);
  markFirstAlert(bubble);
  draw(model, `${chatKey}:${r.verdict}`, bubble !== undefined);
}

/** Banner for the current chat; closing it keeps a small pill for that chat and verdict, until a new verdict. */
function draw(model: BannerModel | null, id: string, hasBubble: boolean): void {
  if (model === null) return renderBanner(null, NO_BANNER);
  renderBanner(model, {
    id,
    collapsed: dismissed === id,
    onCollapse: () => {
      dismissed = id;
      draw(model, id, hasBubble);
    },
    onExpand: () => {
      dismissed = '';
      draw(model, id, hasBubble);
    },
    // Looked up on click: WhatsApp may have re-rendered the bubble since the banner was drawn.
    onShowMessage: hasBubble
      ? () => {
          const el = document.querySelector<HTMLElement>('.scam-shield-first-alert');
          if (el) showMessage(el);
        }
      : undefined,
  });
}

installGuard(() => {
  const chat = readDoc();
  return chat !== null && guard !== null && threadKey(chat.title, []) === guard.chat ? guard : null;
});

new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(() => void check().catch(() => undefined), DEBOUNCE_MS);
}).observe(document.body, { childList: true, subtree: true, characterData: true });
