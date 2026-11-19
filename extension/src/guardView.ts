import type { Result } from '@ss/contracts';
import { guardHit, guardText, type GuardKind } from './guard';
import { localVoice, speak, stopSpeaking } from './speech';
import { button, layer, leave, node } from './ui';

/** What the guard needs to know about the chat that is open right now. */
export interface GuardState {
  verdict: Result['verdict'];
  action: string;
}

// WHY these selectors: like dom.ts, avoid WhatsApp's generated class names. The composer is the only editable
// box in the chat footer, and the send button is recognised by its icon name or its label.
const COMPOSER = '#main footer [contenteditable="true"]';
const SEND_LABEL = /^(send|trimite)/i;

const composerText = (): string => document.querySelector(COMPOSER)?.textContent ?? '';

function sendButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const btn = target.closest<HTMLElement>('#main footer button, #main footer [role="button"]');
  if (btn === null) return null;
  const isSend = SEND_LABEL.test(btn.getAttribute('aria-label') ?? '') || btn.querySelector('[data-icon*="send"]') !== null;
  return isSend ? btn : null;
}

function findSendButton(): HTMLElement | null {
  const icon = document.querySelector('#main footer [data-icon*="send"]');
  return sendButton(icon) ?? document.querySelector<HTMLElement>('#main footer button[aria-label^="Send"]');
}

function close(root: ShadowRoot): void {
  stopSpeaking();
  leave(root.querySelector('.guard'));
  leave(root.querySelector('.backdrop'));
  // Back to where the reader was typing, so the keyboard keeps working as before.
  document.querySelector<HTMLElement>(COMPOSER)?.focus();
}

/** Tab and Shift+Tab stay inside the dialog; Escape is "Nu trimit". */
function trapKeys(box: HTMLElement, root: ShadowRoot): void {
  box.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep WhatsApp's shortcuts away while the dialog is open
    if (e.key === 'Escape') return close(root);
    if (e.key !== 'Tab') return;
    const items = [...box.querySelectorAll<HTMLElement>('button')];
    const at = items.indexOf(root.activeElement as HTMLElement);
    const next = (at + (e.shiftKey ? -1 : 1) + items.length) % items.length;
    e.preventDefault();
    items[next]?.focus();
  });
}

/** The stop note above the composer. "Nu trimit" is the default and gets focus, so Enter keeps it safe. */
function renderGuard(kind: GuardKind, action: string, onSendAnyway: () => void): void {
  const root = layer();
  if (root.querySelector('.guard:not(.leaving)')) return; // already asking
  const backdrop = node('div', 'backdrop');
  backdrop.addEventListener('click', () => close(root));
  const box = node('section', 'card guard scam');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  const message = guardText(kind, action);
  const head = node('p', 'headline');
  head.append(node('span', 'icon', '✋'), node('span', '', 'Stați puțin!'));
  const text = node('p', 'body', message.replace(/^Stați puțin!\s*/, ''));
  text.id = 'scam-shield-guard-text';
  box.setAttribute('aria-labelledby', text.id);
  const row = node('div', 'row');
  const stay = button('Nu trimit', 'primary', () => close(root));
  const send = button('Trimit oricum', '', () => {
    close(root);
    onSendAnyway();
  });
  row.append(stay);
  if (localVoice() !== null) row.append(button('🔊 Ascultați', '', () => void speak(message)));
  row.append(send);
  box.append(head, text, row);
  trapKeys(box, root);
  root.append(backdrop, box);
  stay.focus();
}

/**
 * Catch Enter in the composer and clicks on the send button, in the capture phase so WhatsApp never sees a
 * blocked send. The draft is read in memory only: it is not stored, logged or sent anywhere.
 */
export function installGuard(current: () => GuardState | null): void {
  let allowed = '';
  const intercept = (e: Event): void => {
    const state = current();
    if (state === null) return;
    const draft = composerText();
    const kind = guardHit(draft, state.verdict, allowed);
    if (kind === null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    renderGuard(kind, state.action, () => {
      allowed = draft;
      findSendButton()?.click();
    });
  };
  window.addEventListener('keydown', (e) => {
    const inComposer = e.target instanceof Element && e.target.closest(COMPOSER) !== null;
    if (e.key === 'Enter' && !e.shiftKey && inComposer) intercept(e);
  }, true);
  window.addEventListener('click', (e) => {
    if (sendButton(e.target) !== null) intercept(e);
  }, true);
}
