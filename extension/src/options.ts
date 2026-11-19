import { checkConfig, sendPage, type PagerConfig, type PagerProblem } from './pager';
import { loadPager, savePager } from './pagerStore';

const PROBLEM_RO: Record<PagerProblem, string> = {
  server: 'Adresa serverului nu este corectă (de ex. http://192.168.1.20:8090).',
  not_local: 'Serverul trebuie să fie în rețeaua de acasă, nu pe internet.',
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
  } catch {
    status('Nu am putut trimite. Verificați că serverul ntfy rulează și că sunteți în aceeași rețea.');
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
