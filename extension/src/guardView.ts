import type { Result } from '@ss/contracts';
import { guardHit, guardText, type GuardKind } from './guard';

/** What the guard needs to know about the chat that is open right now. */
export interface GuardState {
  verdict: Result['verdict'];
  action: string;
}

const NOTE_ID = 'scam-shield-guard';
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

function button(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = `margin:8px 8px 0 0;padding:10px 18px;border-radius:10px;font:600 18px system-ui,sans-serif;
    cursor:pointer;border:2px solid #b3261e;${primary ? 'background:#b3261e;color:#fff;' : 'background:#fff;color:#5f1410;'}`;
  b.addEventListener('click', onClick);
  return b;
}

/** The stop note above the composer. "Nu trimit" is the default and gets focus, so Enter keeps it safe. */
function renderGuard(kind: GuardKind, action: string, onSendAnyway: () => void): void {
  document.getElementById(NOTE_ID)?.remove();
  const box = document.createElement('div');
  box.id = NOTE_ID;
  box.setAttribute('role', 'alertdialog');
  box.style.cssText = `position:fixed;bottom:96px;left:50%;transform:translateX(-50%);z-index:2147483647;
    max-width:560px;width:calc(100% - 32px);box-sizing:border-box;padding:16px 20px;border-radius:12px;
    background:#fdecea;color:#5f1410;border:3px solid #b3261e;box-shadow:0 6px 24px rgba(0,0,0,.25);
    font:18px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;`;
  const text = document.createElement('p');
  text.style.cssText = 'margin:0;font-weight:600;';
  text.textContent = `✋ ${guardText(kind, action)}`;
  const close = (): void => box.remove();
  const stay = button('Nu trimit', true, close);
  const send = button('Trimit oricum', false, () => {
    close();
    onSendAnyway();
  });
  box.append(text, stay, send);
  document.body.append(box);
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
