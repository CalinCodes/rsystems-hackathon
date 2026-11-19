// Shared look for everything the extension draws inside WhatsApp Web.
// WHY a shadow root: WhatsApp's own CSS (fonts, resets, button styles) would otherwise leak into our banner and
// change between WhatsApp releases. Inside the shadow root the styles below are the only ones that apply.
// System fonts only: nothing is fetched from anywhere.

// The mascot lives in the app so both draw the same figure; it is plain TS with no React, so it bundles here too.
import { thiefDataUrl, type ThiefMood } from '../../app/src/thief';

const HOST_ID = 'scam-shield-root';
const LEAVE_MS = 200;

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.card { position: fixed; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 640px;
  padding: 18px 20px 16px; border-radius: 16px; border: 3px solid var(--line); background: var(--bg); color: var(--fg);
  box-shadow: 0 10px 30px rgba(0,0,0,.28); font: 20px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.scam { --bg: #fdecea; --fg: #3d0b08; --line: #b3261e; --soft: #ffffff; }
.suspicious { --bg: #fff4e0; --fg: #3a2300; --line: #a15c00; --soft: #ffffff; }
.info { --bg: #eef1f5; --fg: #17202a; --line: #52606d; --soft: #ffffff; }
.banner { top: 12px; animation: drop .24s ease-out both; }
.banner.escalate { animation: drop .24s ease-out both, pulse 1.1s ease-out .25s 2; }
.headline { display: flex; align-items: center; gap: 10px; margin: 0 48px 8px 0; font-size: 23px; font-weight: 800; }
.headline .icon { font-size: 30px; line-height: 1; }
.figure { width: 72px; height: 72px; flex-shrink: 0; margin: -6px 2px -6px -6px; animation: pop .5s cubic-bezier(.3,1.5,.6,1) both; }
@keyframes pop { from { opacity: 0; transform: scale(.5) rotate(-10deg); } }
.body { margin: 0 0 10px; font-weight: 600; }
.note { margin: 0 0 10px; }
.action { margin: 0 0 14px; padding: 10px 14px; border-radius: 12px; background: var(--soft); border-left: 6px solid var(--line);
  font-weight: 700; }
.action b { display: block; font-size: 16px; text-transform: uppercase; letter-spacing: .04em; }
.footer { margin: 12px 0 0; font-size: 16px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; }
button { font: 700 19px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; min-height: 48px; padding: 10px 18px;
  border-radius: 12px; border: 2px solid var(--line); background: var(--soft); color: var(--fg); cursor: pointer;
  transition: transform .12s ease, filter .12s ease; }
button:hover { filter: brightness(.94); }
button:active { transform: scale(.97); }
button:focus-visible { outline: 4px solid #1a56db; outline-offset: 3px; }
button.primary { background: var(--line); color: #fff; }
.close { position: absolute; top: 8px; right: 8px; width: 48px; padding: 0; border: 0; background: transparent; font-size: 30px; }
.pill { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); border-radius: 999px; padding: 10px 20px;
  white-space: nowrap; max-width: calc(100vw - 32px); overflow: hidden; text-overflow: ellipsis;
  border: 3px solid var(--line); background: var(--bg); color: var(--fg); box-shadow: 0 6px 20px rgba(0,0,0,.22);
  animation: drop .2s ease-out both; }
.backdrop { position: fixed; inset: 0; background: rgba(20,10,10,.38); animation: fade .2s ease-out both; }
.guard { bottom: 96px; animation: rise .24s ease-out both; }
.leaving, .leaving.banner, .leaving.guard { animation: leave ${LEAVE_MS}ms ease-in both; }
.backdrop.leaving { animation: fadeout ${LEAVE_MS}ms ease-in both; }
@keyframes drop { from { opacity: 0; transform: translate(-50%, -16px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes rise { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes leave { to { opacity: 0; transform: translate(-50%, -10px); } }
@keyframes fade { from { opacity: 0; } }
@keyframes fadeout { to { opacity: 0; } }
@keyframes pulse { from { box-shadow: 0 0 0 0 rgba(179,38,30,.6); } to { box-shadow: 0 0 0 18px rgba(179,38,30,0); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
@media (forced-colors: active) { .card, .pill, button { border: 3px solid CanvasText; } }
`;

/** The one shadow root all our UI lives in, created on first use. */
export function layer(): ShadowRoot {
  const existing = document.getElementById(HOST_ID)?.shadowRoot;
  if (existing) return existing;
  const host = document.createElement('div');
  host.id = HOST_ID;
  // Max z-index on the host: everything inside stacks above WhatsApp.
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  root.append(style);
  document.body.append(host);
  return root;
}

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Play the exit animation, then remove. With reduced motion there is no animation, so remove at once. */
export function leave(el: Element | null | undefined): void {
  if (!el) return;
  if (reducedMotion()) return el.remove();
  el.classList.add('leaving');
  setTimeout(() => el.remove(), LEAVE_MS);
}

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls !== '') el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = node('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/**
 * The Scam Shield thief, same drawing as the app. Decorative (empty alt): the words beside it carry the verdict.
 * If WhatsApp's page rules ever refuse the image, it simply disappears and the banner still works.
 */
export function thiefImg(mood: ThiefMood): HTMLImageElement {
  const img = node('img', 'figure');
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.addEventListener('error', () => img.remove());
  img.src = thiefDataUrl(mood);
  return img;
}
