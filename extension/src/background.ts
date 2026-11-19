import type { Result, Scenario } from '@ss/contracts';
import { analyze, embed, loadWeights } from '@ss/engine';
import weightsJson from '../../ml/out/weights.json';
import { shouldNotify } from './banner';
import { cachedEmbed } from './embedCache';
import { decidePage, sendPage } from './pager';
import { loadMark, loadPager, saveLast, saveMark } from './pagerStore';
import { threadKey } from './thread';

// Runs in the extension's service worker, not in the page: only here may we call localhost:11434.
// Ollama accepts the call only if OLLAMA_ORIGINS allows chrome-extension://*; otherwise analyze()
// falls back to rules alone, which still give a full verdict.
const weights = loadWeights(weightsJson);
const embedFn = cachedEmbed(embed);
const lastNotified = new Map<number, string>();
// Chats with an alert decision in progress: two analyses of the same chat arriving together must not page twice.
const paging = new Set<string>();

export interface AnalyzeRequest {
  type: 'ss-analyze';
  chat: string;
  scenario: Scenario;
}

const isRequest = (m: unknown): m is AnalyzeRequest =>
  typeof m === 'object' && m !== null && (m as { type?: unknown }).type === 'ss-analyze';

async function flagTab(tabId: number | undefined, chat: string, r: Result): Promise<void> {
  if (tabId === undefined) return;
  const color = r.verdict === 'SCAM' ? '#b3261e' : '#a15c00';
  await chrome.action.setBadgeText({ text: r.verdict === 'SAFE' ? '' : '!', tabId });
  await chrome.action.setBadgeBackgroundColor({ color, tabId });
  if (!shouldNotify(lastNotified.get(tabId), chat, r)) return;
  lastNotified.set(tabId, `${chat}:${r.verdict}`);
  await chrome.notifications.create(`ss-${tabId}-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: r.verdict === 'SCAM' ? 'Scam Shield: pare o țeapă!' : 'Scam Shield: verificați înainte să răspundeți',
    message: `${r.warning.ro} ${r.warning.action}`,
    priority: 2,
  });
}

/**
 * Pager to a trusted family member (opt-in, options page). Runs independently of the badge and the Chrome
 * notification, so a failure there can never swallow the alert, and a dead ntfy server never delays the banner.
 */
async function pageFamily(chat: string, s: Scenario, r: Result): Promise<void> {
  if (r.verdict !== 'SCAM' || paging.has(chat)) return;
  paging.add(chat);
  try {
    const cfg = await loadPager();
    if (!cfg.enabled) return;
    const last = s.messages.at(-1);
    const lastMsg = last ? threadKey('', [{ outgoing: last.from === 'reader', text: last.text }]) : '';
    const now = Date.now();
    if (decidePage(await loadMark(chat), r, lastMsg, now) !== 'page') return;
    // Exactly ONE request per detected scam message: the mark is written BEFORE sending and there is no retry.
    // ntfy.sh limits each public IP (60-request burst, then 1 per 5 s, 250 messages a day), and at a venue every
    // laptop shares one IP, so retries and repeats used to burn the allowance and get every later alert refused.
    await saveMark(chat, { at: now, msg: lastMsg });
    try {
      await sendPage(cfg, r);
      await saveLast({ at: Date.now(), outcome: 'sent', attempts: 1 });
    } catch (e) {
      await saveLast({ at: Date.now(), outcome: 'failed', attempts: 1, error: e instanceof Error ? e.message : 'eroare' });
    }
  } catch {
    // storage unavailable: nothing to page with; the reader's own warning is unaffected
  } finally {
    paging.delete(chat);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRequest(message)) return undefined;
  void analyze(message.scenario, { weights, embedFn })
    .then(async (r) => {
      sendResponse(r);
      // Separate try blocks: a closed tab or a notification error used to skip the reply AND the family alert.
      await Promise.allSettled([flagTab(sender.tab?.id, message.chat, r), pageFamily(message.chat, message.scenario, r)]);
    })
    .catch(() => sendResponse(null));
  return true; // keeps the channel open for the async reply
});
