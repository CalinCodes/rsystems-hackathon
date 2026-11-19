import { checkConfig, sendPage, type PagerConfig, type PagerProblem } from './pager';
import { loadLast, loadPager, savePager } from './pagerStore';

const PROBLEM_RO: Record<PagerProblem, string> = {
  server: 'Adresa serverului nu este corectă (de ex. http://192.168.1.20:8090).',
  not_local: 'Folosiți https://ntfy.sh sau un server ntfy din rețeaua de acasă.',
  topic: 'Subiectul poate avea doar litere, cifre, - și _ (maxim 64).',
  name: 'Scrieți un nume scurt (maxim 40 de caractere).',
};

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const status = (text: string): void => {
  $('status').textContent = text;
};

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
  status(c.enabled ? 'Salvat. Alertele sunt pornite.' : 'Salvat. Alertele sunt oprite.');
}

async function onTest(): Promise<void> {
  const c = read();
  if (!(await validateAndGrant(c))) return;
  try {
    await sendPage(c, { scamType: 'OTHER' }, { test: true });
    status('Test trimis. Verificați telefonul.');
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
$('save').addEventListener('click', () => void onSave());
$('test').addEventListener('click', () => void onTest());

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
