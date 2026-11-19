import { readFileSync } from 'node:fs';
import { ALL_FLAGS } from '@ss/contracts';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

interface Entry {
  ro: string;
  en: string;
  action: string;
}
type TypeBlock = Record<string, Entry | string>;

const TYPES = [
  'BANK_IMPERSONATION', 'COURIER_FEE', 'AUTHORITY_IMPERSONATION', 'FAMILY_EMERGENCY', 'TECH_SUPPORT',
  'MARKETPLACE', 'ACCOUNT_TAKEOVER', 'INVESTMENT', 'ROMANCE', 'JOB_OFFER', 'PRIZE_LOTTERY', 'OTHER', 'NONE',
];
const doc = parse(readFileSync(new URL('./warnings.yaml', import.meta.url), 'utf8')) as Record<string, unknown>;
const lead = doc.lead as Record<string, string>;
const leadEn = doc.lead_en as Record<string, string>;

/** Every filled text of a type: entries (ro, en, action) plus its fallback action. */
function entriesOf(type: string): { key: string; e: Entry }[] {
  const block = doc[type] as TypeBlock;
  return Object.entries(block)
    .filter((kv): kv is [string, Entry] => typeof kv[1] !== 'string')
    .map(([key, e]) => ({ key, e }));
}

// A sentence ends at . ! or ? and the text may not continue after it.
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => x.length > 0);

describe('warnings.yaml structure', () => {
  it('has a lead for SCAM and SUSPICIOUS in both languages, one sentence each', () => {
    for (const l of [lead, leadEn]) {
      expect(Object.keys(l).sort()).toEqual(['SCAM', 'SUSPICIOUS']);
      for (const text of Object.values(l)) expect(sentences(text)).toHaveLength(1);
    }
  });

  it('covers every scam type with a default and a fallback action', () => {
    for (const t of TYPES) {
      const block = doc[t] as TypeBlock;
      expect(block, t).toBeDefined();
      expect(block._default, `${t} _default`).toBeDefined();
      expect(typeof block.action_fallback, `${t} action_fallback`).toBe('string');
    }
  });

  it('only keys entries by real flags', () => {
    for (const t of TYPES) {
      for (const { key } of entriesOf(t)) {
        expect(key === '_default' || (ALL_FLAGS as string[]).includes(key), `${t}.${key}`).toBe(true);
      }
    }
  });

  it('has an internet-address entry for the four types that have a catalog organisation', () => {
    for (const t of ['BANK_IMPERSONATION', 'COURIER_FEE', 'AUTHORITY_IMPERSONATION', 'MARKETPLACE']) {
      expect((doc[t] as TypeBlock).RF_SUSPICIOUS_CONTACT, t).toBeDefined();
    }
  });
});

describe('warnings.yaml wording', () => {
  it('writes ro, en and action as exactly one sentence each', () => {
    for (const t of TYPES) {
      const fallback = (doc[t] as TypeBlock).action_fallback as string;
      expect(sentences(fallback), `${t} fallback`).toHaveLength(1);
      for (const { key, e } of entriesOf(t)) {
        for (const f of ['ro', 'en', 'action'] as const) {
          expect(sentences(e[f]), `${t}.${key}.${f}`).toHaveLength(1);
        }
      }
    }
  });

  it('adds up to exactly three sentences once the engine puts the lead in front', () => {
    for (const t of TYPES) {
      for (const { key, e } of entriesOf(t)) {
        for (const verdict of ['SCAM', 'SUSPICIOUS']) {
          const full = `${lead[verdict]} ${e.ro} ${e.action}`;
          expect(sentences(full), `${t}.${key}.${verdict}`).toHaveLength(3);
        }
      }
    }
  });

  it('never starts ro with "Atenție" (the lead already says it)', () => {
    for (const t of TYPES) {
      for (const { key, e } of entriesOf(t)) expect(e.ro.startsWith('Atenție'), `${t}.${key}`).toBe(false);
    }
  });

  it('prints no link and no phone number: the engine fills the number from the catalog', () => {
    for (const t of TYPES) {
      const block = doc[t] as TypeBlock;
      const texts = [block.action_fallback as string, ...entriesOf(t).flatMap(({ e }) => [e.ro, e.en, e.action])];
      for (const text of texts) {
        expect(text, `${t}: ${text}`).not.toMatch(/https?:|www\.|\.ro\b|\blink\b|\d{3}/i);
      }
    }
  });

  it('keeps {official_contact} in action only, and every such type has a fallback without it', () => {
    for (const t of TYPES) {
      const block = doc[t] as TypeBlock;
      expect(block.action_fallback as string).not.toContain('{');
      for (const { key, e } of entriesOf(t)) {
        expect(e.ro + e.en, `${t}.${key}`).not.toContain('{');
        const braces = e.action.match(/\{[^}]*\}/g) ?? [];
        for (const b of braces) expect(b).toBe('{official_contact}');
      }
    }
  });
});
