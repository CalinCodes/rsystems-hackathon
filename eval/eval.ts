// Usage: npm run eval -- <folder> <expected.csv> [--twice] [--ablation]
// PRIVACY: this file must only ever print ids, codes and numbers — never message text.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExpectedRow, FlagCode, Result, ScamType, Scenario, Verdict } from '@ss/contracts';
import { analyze, loadWeights, type AnalyzeOptions, type Thresholds } from '@ss/engine';

interface Scored {
  points: number;
  max: number;
}

function parseCsv(path: string): ExpectedRow[] {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = (lines.shift() ?? '').split(',').map((h) => h.trim());
  const col = (cells: string[], name: string): string => cells[header.indexOf(name)]?.trim() ?? '';
  return lines.map((line) => {
    const c = line.split(',');
    const fa = col(c, 'first_alert');
    const range = /^(\d+)-(\d+)$/.exec(fa);
    const first = range ? Number(range[1]) : fa === '' ? null : Number(fa);
    const flags = col(c, 'red_flags');
    return {
      id: col(c, 'id'),
      verdict: col(c, 'verdict') as Verdict,
      scamType: col(c, 'scam_type') as ScamType,
      score: Number(col(c, 'risk_score')),
      firstAlert: first,
      firstAlertWindow: range ? [Number(range[1]), Number(range[2])] : null,
      flags: flags === '' ? [] : (flags.split(';').map((f) => f.trim()) as FlagCode[]),
    };
  });
}

/** Official accuracy: verdict +3, type +2, alert timing +2/+1 on non-SAFE threads, missed scam -3. */
function scoreOne(exp: ExpectedRow, got: Result, messageCount: number): Scored {
  const alertApplies = messageCount > 1 && exp.verdict !== 'SAFE';
  let points = 0;
  if (got.verdict === exp.verdict) points += 3;
  if (got.scamType === exp.scamType) points += 2;
  if (alertApplies && exp.firstAlert !== null && got.firstAlert !== null) {
    const [lo, hi] = exp.firstAlertWindow ?? [exp.firstAlert, exp.firstAlert];
    if (got.firstAlert >= lo && got.firstAlert <= hi) points += 2;
    else if (got.firstAlert === hi + 1) points += 1;
  }
  if (exp.verdict !== 'SAFE' && got.verdict === 'SAFE') points -= 3;
  return { points, max: alertApplies ? 7 : 5 };
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

/** Flag codes the model added on top of rules, per id: tells which flag to blame when a row flips. */
function printClfAdds(base: Result[], withClf: Result[]): void {
  withClf.forEach((r, i) => {
    const had = new Set(base[i]?.hits.map((h) => h.flag));
    const added = [...new Set(r.hits.filter((h) => h.src === 'clf' && !had.has(h.flag)).map((h) => `${h.flag}@${h.msg}`))];
    if (added.length > 0) console.log(`  ${r.id} clf added: ${added.join(' ')}`);
  });
}

async function runAll(scenarios: Scenario[], opts: AnalyzeOptions): Promise<Result[]> {
  const out: Result[] = [];
  for (const s of scenarios) out.push(await analyze(s, opts));
  return out;
}

/** Timings are wall-clock and legitimately vary; everything else must be identical. */
const stable = (r: Result): string => JSON.stringify({ ...r, timingsMs: {} });

const pad = (v: string | number | null, n: number): string => String(v ?? '-').padEnd(n);

function report(label: string, scenarios: Scenario[], results: Result[], expected: Map<string, ExpectedRow>, table: boolean): number {
  let raw = 0;
  let max = 0;
  if (table) console.log(`${pad('id', 8)}${pad('verdict exp/got', 26)}${pad('type exp/got', 44)}${pad('alert', 8)}${pad('score', 10)}ok`);
  results.forEach((r, i) => {
    const exp = expected.get(r.id);
    const n = scenarios[i]?.messages.length ?? 0;
    if (!exp) return console.warn(`no expected row for id ${r.id}`);
    const s = scoreOne(exp, r, n);
    raw += s.points;
    max += s.max;
    if (table) {
      console.log(
        `${pad(r.id, 8)}${pad(`${exp.verdict}/${r.verdict}`, 26)}${pad(`${exp.scamType}/${r.scamType}`, 44)}` +
          `${pad(`${exp.firstAlert ?? '-'}/${r.firstAlert ?? '-'}`, 8)}${pad(`${exp.score}/${r.score}`, 10)}${s.points === s.max ? '✓' : '✗'}`,
      );
    }
  });
  const scaled = max > 0 ? (raw / max) * 30 : 0;
  console.log(`[${label}] raw ${raw} / max ${max}  →  ${scaled.toFixed(1)} / 30`);
  return raw;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const [folder, csv] = args.filter((a) => !a.startsWith('--'));
  if (!folder || !csv) {
    console.error('Usage: npm run eval -- <folder> <expected.csv> [--twice] [--ablation]');
    process.exit(2);
  }

  const dir = resolve(folder);
  const scenarios = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Scenario)
    .sort((a, b) => a.id.localeCompare(b.id));
  const expected = new Map(parseCsv(resolve(csv)).map((r) => [r.id, r]));

  const results = await runAll(scenarios, {});
  report('rules only', scenarios, results, expected, true);

  if (flags.has('--twice')) {
    const again = await runAll(scenarios, {});
    const bad = results.filter((r, i) => stable(r) !== stable(again[i] as Result)).map((r) => r.id);
    if (bad.length > 0) {
      console.error(`NON-DETERMINISTIC results for ids: ${bad.join(', ')}`);
      process.exit(1);
    }
    console.log('determinism: OK (2 identical runs)');
  }

  if (flags.has('--ablation')) {
    // Needs Ollama + bge-m3 on localhost:11434. Compares both cut sets from ml/train.py.
    const weights = loadWeights(readJson('../ml/out/weights.json'));
    for (const [label, file] of [['rules+clf p90', 'thresholds.json'], ['rules+clf p80', 'thresholds.p80.json']] as const) {
      const thresholds = readJson(`../ml/out/${file}`) as Thresholds;
      const withClf = await runAll(scenarios, { weights, thresholds });
      if (withClf.some((r) => r.timingsMs.clfUnavailable === 1)) {
        console.error(`[${label}] embedder unavailable: is Ollama running with bge-m3?`);
        process.exit(1);
      }
      report(label, scenarios, withClf, expected, true);
      printClfAdds(results, withClf);
    }
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : 'eval failed');
  process.exit(1);
});
