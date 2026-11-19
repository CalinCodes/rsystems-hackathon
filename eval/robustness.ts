// Usage: npm run robust -- <folder>...
// Applies 8 deterministic mutations (seed 42) to every scenario and checks the engine still gives the same verdict
// and scam type. An id counts as changed when its verdict or type moves, or when its first alert is not where the
// mutation should put it (the original one, shifted by 2 for "openers").
// PRIVACY: this file must only ever print mutation names, ids and numbers — never message text.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Result, Scenario } from '@ss/contracts';
import { analyze } from '@ss/engine';

const SEED = 42;

/** mulberry32: tiny, fast, and the same sequence on every machine. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One random stream per (mutation, scenario): results do not depend on file order. */
function streamFor(mutation: string, id: string): () => number {
  let h = SEED;
  for (const ch of `${mutation}:${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return rng(h);
}

type Rand = () => number;
type TextFn = (text: string, rand: Rand) => string;

const pick = <T>(xs: readonly T[], rand: Rand): T | undefined => xs[Math.floor(rand() * xs.length)];

const stripDiacritics: TextFn = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const upper: TextFn = (t) => t.toUpperCase();

function swapAdjacent(t: string, rand: Rand): string {
  const chars = [...t];
  for (let k = 0; k < 2; k++) {
    const spots = chars.flatMap((c, i) => (/\p{L}/u.test(c) && /\p{L}/u.test(chars[i + 1] ?? '') ? [i] : []));
    const i = pick(spots, rand);
    if (i === undefined) break;
    [chars[i], chars[i + 1]] = [chars[i + 1] ?? '', chars[i] ?? ''];
  }
  return chars.join('');
}

const HOMO: Record<string, string> = { a: 'à', i: 'í', o: '0' };
// A host = labels joined by dots, ending in a letter TLD ("bancadunarea-securitate.com", "anaf.ro").
const HOST = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;

function homoglyphHost(t: string, rand: Rand): string {
  return t.replace(HOST, (host) => {
    const tld = host.lastIndexOf('.');
    const spots = [...host.slice(0, tld)].flatMap((c, i) => (c.toLowerCase() in HOMO ? [i] : []));
    const i = pick(spots, rand);
    if (i === undefined) return host;
    return host.slice(0, i) + (HOMO[host[i]?.toLowerCase() ?? ''] ?? '') + host.slice(i + 1);
  });
}

// Phone-like runs: 8+ digits or masks ("+40 7xx xxx 552"), with spaces, dots or dashes between groups.
const PHONE = /\+?\d[\dx\s.-]{6,}[\dx]/gi;
const spacePhones: TextFn = (t) =>
  t.replace(PHONE, (p) => {
    const digits = p.replace(/[\s.-]/g, '');
    return digits.length >= 8 ? [...digits].join(' ') : p;
  });

const EMOJI = ['🙂', '🙏', '😊', '👍', '❤️'];
function insertEmoji(t: string, rand: Rand): string {
  const words = t.split(' ');
  if (words.length < 2) return `${t} ${pick(EMOJI, rand) ?? ''}`;
  const at = 1 + Math.floor(rand() * (words.length - 1));
  words.splice(at, 0, pick(EMOJI, rand) ?? '');
  return words.join(' ');
}

// Formal "dvs." / "dumneavoastră" to informal "tu": grammar suffers on purpose, as in real hurried messages.
const toTu: TextFn = (t) => t.replace(/\bdumneavoastr[aă]\b/gi, 'tu').replace(/\bdvs\b\.?/gi, 'tu');

interface Mutation {
  name: string;
  apply: (s: Scenario, rand: Rand) => Scenario;
  /** Message-number shift the mutation causes, for the expected first alert. */
  shift: number;
}

/** Applies a text change to sender messages only: the reader's own words are not what the engine judges. */
const onSender = (name: string, fn: TextFn): Mutation => ({
  name,
  shift: 0,
  apply: (s, rand) => ({ ...s, messages: s.messages.map((m) => (m.from === 'sender' ? { ...m, text: fn(m.text, rand) } : m)) }),
});

const OPENERS = ['Bună ziua!', 'Sper că sunteți bine.'];
const openers: Mutation = {
  name: 'openers',
  shift: OPENERS.length,
  apply: (s) => ({
    ...s,
    messages: [
      ...OPENERS.map((text, i) => ({ n: i + 1, from: 'sender' as const, text })),
      ...s.messages.map((m) => ({ ...m, n: m.n + OPENERS.length })),
    ],
  }),
};

const MUTATIONS: Mutation[] = [
  onSender('strip-diacritics', stripDiacritics),
  onSender('uppercase', upper),
  onSender('adjacent-swaps', swapAdjacent),
  onSender('homoglyph-host', homoglyphHost),
  onSender('spaced-phone', spacePhones),
  onSender('emoji', insertEmoji),
  onSender('dvs-to-tu', toTu),
  openers,
];

function load(folders: string[]): Scenario[] {
  return folders
    .flatMap((f) => {
      const dir = resolve(f);
      return readdirSync(dir)
        .filter((n) => n.endsWith('.json'))
        .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')) as Scenario);
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

const pct = (n: number, d: number): string => (d === 0 ? '-' : `${((n / d) * 100).toFixed(1)}%`);

async function main(): Promise<void> {
  const folders = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (folders.length === 0) {
    console.error('Usage: npm run robust -- <folder>...');
    process.exit(2);
  }
  const scenarios = load(folders);
  const base = new Map<string, Result>();
  for (const s of scenarios) base.set(s.id, await analyze(s));

  console.log('mutation | scenarios | verdict unchanged % | type unchanged % | ids that changed');
  let all = 0;
  let allVerdict = 0;
  let allType = 0;
  const allChanged = new Set<string>();
  for (const mut of MUTATIONS) {
    let sameVerdict = 0;
    let sameType = 0;
    const changed: string[] = [];
    for (const s of scenarios) {
      const before = base.get(s.id);
      if (!before) continue;
      const after = await analyze(mut.apply(s, streamFor(mut.name, s.id)));
      const expectedAlert = before.firstAlert === null ? null : before.firstAlert + mut.shift;
      if (after.verdict === before.verdict) sameVerdict++;
      if (after.scamType === before.scamType) sameType++;
      if (after.verdict !== before.verdict || after.scamType !== before.scamType || after.firstAlert !== expectedAlert) {
        changed.push(s.id);
        allChanged.add(s.id);
      }
    }
    all += scenarios.length;
    allVerdict += sameVerdict;
    allType += sameType;
    const n = scenarios.length;
    console.log(`${mut.name} | ${n} | ${pct(sameVerdict, n)} | ${pct(sameType, n)} | ${changed.join(' ') || '-'}`);
  }
  console.log(`TOTAL | ${all} | ${pct(allVerdict, all)} | ${pct(allType, all)} | ${[...allChanged].sort().join(' ') || '-'}`);
}

main().catch((e: unknown) => {
  // Only the error type: a JSON parse message can quote a piece of the file, i.e. message text.
  console.error(`robustness run failed (${e instanceof Error ? e.name : 'unknown error'})`);
  process.exit(1);
});
