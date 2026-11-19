import type { Result, Scenario } from '@ss/contracts';
import { analyze, embed, loadWeights } from '@ss/engine';
import weightsJson from '../../ml/out/weights.json';
import { shouldNotify } from './banner';
import { cachedEmbed } from './embedCache';

// Runs in the extension's service worker, not in the page: only here may we call localhost:11434.
// Ollama accepts the call only if OLLAMA_ORIGINS allows chrome-extension://*; otherwise analyze()
// falls back to rules alone, which still give a full verdict.
const weights = loadWeights(weightsJson);
const embedFn = cachedEmbed(embed);
const lastNotified = new Map<number, string>();

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isRequest(message)) return undefined;
  void analyze(message.scenario, { weights, embedFn })
    .then(async (r) => {
      await flagTab(sender.tab?.id, message.chat, r);
      sendResponse(r);
    })
    .catch(() => sendResponse(null));
  return true; // keeps the channel open for the async reply
});
