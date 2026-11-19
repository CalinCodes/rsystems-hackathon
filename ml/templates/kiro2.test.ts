import { readFileSync } from 'node:fs';
import { ALL_FLAGS } from '@ss/contracts';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

interface Template {
  type: string;
  flags: string[];
  text: string;
}

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const templates = parse(read('./kiro2.yaml')) as Template[];
const slots = parse(read('../slots.yaml')) as Record<string, unknown>;

// SAFE look-alikes and hard negatives (type NONE) contain trigger words on purpose, so the cue rules
// below apply to scam templates and thread openers only.
const scams = templates.filter((t) => t.type !== 'NONE');
const safe = templates.filter((t) => t.type === 'NONE');
const has = (t: Template, flag: string) => t.flags.includes(flag);

describe('kiro2.yaml shape', () => {
  it('uses only real flags and only slots defined in slots.yaml', () => {
    for (const t of templates) {
      for (const f of t.flags) expect((ALL_FLAGS as string[]).includes(f), `${f} in "${t.text}"`).toBe(true);
      for (const [, slot] of t.text.matchAll(/\{(\w+)\}/g)) {
        expect(slot !== undefined && slot in slots, `slot ${slot} in "${t.text}"`).toBe(true);
      }
    }
  });

  it('has no duplicate texts', () => {
    expect(new Set(templates.map((t) => t.text)).size).toBe(templates.length);
  });

  it('gives each of the six types at least five scam templates', () => {
    for (const type of ['FAMILY_EMERGENCY', 'INVESTMENT', 'ROMANCE', 'JOB_OFFER', 'PRIZE_LOTTERY', 'OTHER']) {
      expect(scams.filter((t) => t.type === type).length, type).toBeGreaterThanOrEqual(5);
    }
  });

  it('has the six look-alikes plus at least fifteen hard negatives, all with no flags', () => {
    expect(safe.length).toBeGreaterThanOrEqual(21);
    for (const t of safe) expect(t.flags, t.text).toEqual([]);
  });

  it('never puts a fake link or an unknown number in a SAFE template', () => {
    for (const t of safe) expect(t.text, t.text).not.toMatch(/\{fake_link\}|\{phone_unknown\}/);
  });
});

describe('kiro2.yaml label rules (cue in text => flag listed)', () => {
  it('{fake_link} => RF_SUSPICIOUS_CONTACT', () => {
    for (const t of scams.filter((x) => x.text.includes('{fake_link}'))) expect(has(t, 'RF_SUSPICIOUS_CONTACT'), t.text).toBe(true);
  });

  it('an organisation speaking as the sender => RF_IMPERSONATION', () => {
    for (const t of scams.filter((x) => /\{(bank|courier|shop|authority)\}/.test(x.text))) {
      expect(has(t, 'RF_IMPERSONATION'), t.text).toBe(true);
    }
  });

  it('urgency words => RF_URGENCY', () => {
    const cue = /\bazi\b|\bacum\b|urgent|în \{deadline\}|locuri limitate|expir/i;
    for (const t of scams.filter((x) => cue.test(x.text))) expect(has(t, 'RF_URGENCY'), t.text).toBe(true);
  });

  it('threat words => RF_THREAT', () => {
    const cue = /blocat|suspendat|deconect|amend|dosar|virus/i;
    for (const t of scams.filter((x) => cue.test(x.text))) expect(has(t, 'RF_THREAT'), t.text).toBe(true);
  });
});
