// Usage: npm run build:extension  →  load extension/dist as an unpacked extension in chrome://extensions
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const out = here('./dist/');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: { background: here('./src/background.ts'), content: here('./src/content.ts') },
  outdir: out,
  bundle: true,
  // IIFE for both: content scripts cannot be modules, and a classic service worker needs no "type" key.
  format: 'iife',
  target: 'chrome120',
  legalComments: 'none',
  logLevel: 'warning',
});
for (const f of ['manifest.json', 'icon128.png']) copyFileSync(here(`./${f}`), `${out}${f}`);
console.log('built extension/dist (load it unpacked in chrome://extensions)');
