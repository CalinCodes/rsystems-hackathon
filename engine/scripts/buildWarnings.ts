// Usage: npm run warnings   (rerun after every edit to content/warnings.yaml)
// WHY a generated JSON: the engine runs in the browser and in node, and neither can read YAML at
// runtime without a loader. warningTexts.test.ts fails when this file is out of date.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { toWarningTexts } from '../src/warningTexts';

const src = new URL('../../content/warnings.yaml', import.meta.url);
const out = new URL('../src/warningTexts.json', import.meta.url);
const texts = toWarningTexts(parse(readFileSync(src, 'utf8')));
writeFileSync(out, `${JSON.stringify(texts, null, 2)}\n`, 'utf8');
console.log(`wrote engine/src/warningTexts.json (${Object.keys(texts.types).length} types)`);
