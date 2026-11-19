import { bannerSignature, spokenText, type BannerModel } from './banner';
import { localVoice, speak, stopSpeaking } from './speech';
import { button, layer, leave, node, reducedMotion } from './ui';

export interface BannerHandlers {
  /** Which chat and verdict this banner belongs to: part of the redraw key, so handlers never go stale. */
  id: string;
  /** The reader closed the banner: it shrinks to a small pill they can reopen, it never just vanishes. */
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  /** Scroll to the message where the alert starts; absent when that message is not on screen. */
  onShowMessage?: () => void;
}

const MARK_CLASS = 'scam-shield-first-alert';
let shown = '';
let lastTone: BannerModel['tone'] | null = null;

function bannerCard(m: BannerModel, h: BannerHandlers, escalate: boolean): HTMLElement {
  const box = node('section', `card banner ${m.tone}${escalate ? ' escalate' : ''}`);
  // A scam interrupts the screen reader; the calm grey note waits its turn.
  box.setAttribute('role', m.tone === 'info' ? 'status' : 'alert');
  box.setAttribute('aria-label', 'Scam Shield');
  const head = node('p', 'headline');
  head.append(node('span', 'icon', m.icon), node('span', '', m.headline));
  const action = node('p', 'action');
  action.append(node('b', '', 'Ce să faceți'), document.createTextNode(m.action));
  const row = node('div', 'row');
  if (localVoice() !== null) row.append(button('🔊 Ascultați', 'primary', () => void speak(spokenText(m))));
  if (h.onShowMessage) row.append(button('👀 Arată mesajul', '', h.onShowMessage));
  row.append(button('Am înțeles', '', h.onCollapse));
  const close = button('×', 'close', h.onCollapse);
  close.setAttribute('aria-label', 'Ascunde avertismentul');
  box.append(head, ...(m.body ? [node('p', 'body', m.body)] : []), ...(m.note ? [node('p', 'note', m.note)] : []));
  box.append(action, row, node('p', 'footer', m.footer), close);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') h.onCollapse();
  });
  return box;
}

function pill(m: BannerModel, h: BannerHandlers): HTMLElement {
  const label = m.tone === 'info' ? 'Număr necunoscut' : 'Avertisment ascuns';
  const p = button(`${m.icon} ${label} – apăsați aici`, `pill ${m.tone}`, h.onExpand);
  p.setAttribute('aria-label', `${m.headline} Apăsați ca să vedeți avertismentul.`);
  return p;
}

/** Draw, update or remove the warning at the top of the window. Same content = left alone, no flicker. */
export function renderBanner(model: BannerModel | null, h: BannerHandlers): void {
  const key = model === null ? '' : `${h.id}|${bannerSignature(model)}|${h.collapsed}|${h.onShowMessage ? 1 : 0}`;
  if (key === shown) return;
  shown = key;
  const root = layer();
  const old = root.querySelector('.banner, .pill');
  if (model === null) {
    stopSpeaking();
    lastTone = null;
    return leave(old);
  }
  const escalate = model.tone === 'scam' && lastTone !== null && lastTone !== 'scam';
  lastTone = model.tone;
  if (h.collapsed) stopSpeaking();
  const next = h.collapsed ? pill(model, h) : bannerCard(model, h, escalate);
  old?.remove();
  root.append(next);
  if (!h.collapsed && old?.classList.contains('pill')) next.querySelector('button')?.focus();
}

const MARK_STYLE = `
.${MARK_CLASS} { outline: 3px solid #b3261e !important; outline-offset: 4px; border-radius: 8px;
  animation: scam-shield-mark 1.2s ease-out 2; }
@keyframes scam-shield-mark { from { box-shadow: 0 0 0 0 rgba(179,38,30,.55); } to { box-shadow: 0 0 0 16px rgba(179,38,30,0); } }
@media (prefers-reduced-motion: reduce) { .${MARK_CLASS} { animation: none; } }`;

function ensureMarkStyle(): void {
  if (document.getElementById('scam-shield-mark-style')) return;
  const s = document.createElement('style');
  s.id = 'scam-shield-mark-style';
  s.textContent = MARK_STYLE;
  document.head.append(s);
}

/** Outline the message where the alert starts, so the reader sees which one is dangerous. */
export function markFirstAlert(bubble: HTMLElement | undefined): void {
  for (const el of document.querySelectorAll(`.${MARK_CLASS}`)) if (el !== bubble) el.classList.remove(MARK_CLASS);
  if (!bubble || bubble.classList.contains(MARK_CLASS)) return;
  ensureMarkStyle();
  bubble.classList.add(MARK_CLASS);
}

/** Bring the dangerous message to the middle of the screen and pulse it again. */
export function showMessage(bubble: HTMLElement): void {
  bubble.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  bubble.classList.remove(MARK_CLASS);
  void bubble.offsetWidth; // restart the pulse animation
  bubble.classList.add(MARK_CLASS);
}
