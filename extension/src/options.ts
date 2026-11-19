import { checkConfig, sendPage, type PagerConfig, type PagerProblem } from './pager';
import { loadLast, loadPager, savePager } from './pagerStore';

const PROBLEM_RO: Record<PagerProblem, string> = {
  server: 'Adresa serverului nu este corectă (de ex. http://192.168.1.20:8090).',
  not_local: 'Folosiți https://ntfy.sh sau un server ntfy din rețeaua de acasă.',
  topic: 'Subiectul poate avea doar litere, cifre, - și _ (maxim 64).',
  name: 'Scrieți un nume scurt (maxim 40 de caractere).',
};

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
/** Green for done, red for a problem: the words say it too, so colour is never the only signal. */
const status = (text: string, tone: 'ok' | 'error' = 'error'): void => {
  const el = $('status');
  el.className = '';
  void el.offsetWidth; // restart the fade-in when the same tone repeats
  el.className = tone;
  el.textContent = `${tone === 'ok' ? '✅' : '⚠️'} ${text}`;
};

/** Show "Se trimite..." and block double clicks while a slow call runs. */
async function busy(id: string, label: string, work: () => Promise<void>): Promise<void> {
  const b = $<HTMLButtonElement>(id);
  const original = b.textContent ?? '';
  b.disabled = true;
  b.textContent = label;
  try {
    await work();
  } finally {
    b.disabled = false;
    b.textContent = original;
  }
}

/** A problem in a folded field opens the fold and puts the cursor in that field. */
function focusField(problem: PagerProblem): void {
  const field = problem === 'not_local' ? 'server' : problem;
  if (field !== 'name') $('server').closest('details')?.setAttribute('open', '');
  $<HTMLInputElement>(field).focus();
}

function read(): PagerConfig {
  return {
    enabled: $<HTMLInputElement>('enabled').checked,
    server: $<HTMLInputElement>('server').value.trim(),
    topic: $<HTMLInputElement>('topic').value.trim(),
    name: $<HTMLInputElement>('name').value.trim(),
  };
}

/** Host permission for exactly this server, asked on the button click (Chrome requires a user gesture). */
async function validateAndGrant(c: PagerConfig): Promise<boolean> {
  const checked = checkConfig(c);
  if ('problem' in checked) {
    status(PROBLEM_RO[checked.problem]);
    focusField(checked.problem);
    return false;
  }
  const granted = await chrome.permissions.request({ origins: [`${checked.origin}/*`] });
  if (!granted) status('Fără permisiune pentru server nu putem trimite alerte.');
  return granted;
}

async function onSave(): Promise<void> {
  const c = read();
  if (c.enabled && !(await validateAndGrant(c))) return;
  await savePager(c);
  status(c.enabled ? 'Salvat. Alertele sunt pornite.' : 'Salvat. Alertele sunt oprite.', 'ok');
}

async function onTest(): Promise<void> {
  const c = read();
  if (!(await validateAndGrant(c))) return;
  try {
    await sendPage(c, { scamType: 'OTHER' }, { test: true });
    status('Test trimis. Verificați telefonul.', 'ok');
  } catch (e) {
    const limited = e instanceof Error && e.message === 'ntfy 429';
    status(limited ? 'ntfy.sh a refuzat: prea multe alerte de pe această rețea azi (limită 250 pe zi). Folosiți hotspotul telefonului sau un server ntfy propriu.' : 'Nu am putut trimite. Verificați conexiunea la internet.');
  }
}

void loadPager().then((c) => {
  $<HTMLInputElement>('enabled').checked = c.enabled;
  $<HTMLInputElement>('server').value = c.server;
  $<HTMLInputElement>('topic').value = c.topic;
  $<HTMLInputElement>('name').value = c.name;
});
$('save').addEventListener('click', () => void busy('save', 'Se salvează…', onSave));
$('test').addEventListener('click', () => void busy('test', 'Se trimite…', onTest));

const time = (ms: number): string => new Date(ms).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
void loadLast().then((l) => {
  if (!l) return;
  $('last').textContent =
    l.outcome === 'sent'
      ? `Ultima alertă: trimisă la ${time(l.at)}.`
      : l.error === 'ntfy 429'
        ? `Ultima alertă (${time(l.at)}) a fost refuzată de ntfy.sh: prea multe alerte de pe această rețea azi. Folosiți altă rețea (de ex. hotspot) sau un server ntfy propriu.`
        : `Ultima alertă: NU a putut fi trimisă la ${time(l.at)} (${l.error ?? 'eroare'}). Verificați internetul.`;
});
