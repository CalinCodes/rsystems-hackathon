import type { BannerModel } from './banner';

const BANNER_ID = 'scam-shield-banner';
const MARK_CLASS = 'scam-shield-first-alert';

// Inline styles and system fonts: no stylesheet or web font is fetched from anywhere.
const TONES: Record<BannerModel['tone'], { bg: string; fg: string; border: string }> = {
  scam: { bg: '#fdecea', fg: '#5f1410', border: '#b3261e' },
  suspicious: { bg: '#fff4e0', fg: '#4a2c00', border: '#a15c00' },
};

/** Draw, replace or remove the warning banner at the top of the window. */
export function renderBanner(model: BannerModel | null, onDismiss: () => void): void {
  document.getElementById(BANNER_ID)?.remove();
  if (model === null) return;
  const t = TONES[model.tone];
  const box = document.createElement('div');
  box.id = BANNER_ID;
  box.setAttribute('role', 'alert');
  box.style.cssText = `position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;
    max-width:640px;width:calc(100% - 32px);box-sizing:border-box;padding:16px 48px 16px 20px;border-radius:12px;
    background:${t.bg};color:${t.fg};border:3px solid ${t.border};box-shadow:0 6px 24px rgba(0,0,0,.25);
    font:18px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;`;
  const body = document.createElement('p');
  body.style.cssText = 'margin:0 0 8px;font-size:20px;font-weight:600;';
  body.textContent = `${model.icon} ${model.body}`;
  const action = document.createElement('p');
  action.style.cssText = 'margin:0 0 8px;font-weight:600;';
  action.textContent = `Ce să faceți: ${model.action}`;
  const footer = document.createElement('p');
  footer.style.cssText = 'margin:0;font-size:15px;opacity:.85;';
  footer.textContent = model.footer;
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Închide avertismentul');
  close.textContent = '×';
  close.style.cssText = `position:absolute;top:8px;right:10px;border:0;background:transparent;color:${t.fg};
    font-size:28px;line-height:1;cursor:pointer;`;
  close.addEventListener('click', () => {
    onDismiss();
    box.remove();
  });
  box.append(body, action, footer, close);
  document.body.append(box);
}

/** Outline the message where the alert starts, so the reader sees which one is dangerous. */
export function markFirstAlert(bubble: HTMLElement | undefined): void {
  for (const el of document.querySelectorAll(`.${MARK_CLASS}`)) {
    el.classList.remove(MARK_CLASS);
    (el as HTMLElement).style.outline = '';
  }
  if (!bubble) return;
  bubble.classList.add(MARK_CLASS);
  bubble.style.outline = '3px solid #b3261e';
  bubble.style.outlineOffset = '4px';
}
