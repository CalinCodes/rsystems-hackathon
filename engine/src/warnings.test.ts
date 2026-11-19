import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import type { Hit } from '@ss/contracts';
import { buildWarning, fillAction, strongestFlag } from './warnings';
import { toWarningTexts } from './warningTexts';
import generated from './warningTexts.json';

const hit = (flag: Hit['flag'], msg = 1): Hit => ({ flag, msg, evidence: '', src: 'rule' });
const sentences = (s: string): string[] => s.split(/(?<=[.!?])\s+/).filter((x) => x.length > 0);
const noCtx = { org: null, threadText: '' };

describe('warningTexts.json', () => {
  it('matches content/warnings.yaml (run `npm run warnings` after editing the YAML)', () => {
    const yaml = parse(readFileSync(new URL('../../content/warnings.yaml', import.meta.url), 'utf8'));
    expect(generated).toEqual(JSON.parse(JSON.stringify(toWarningTexts(yaml))));
  });
});

describe('strongestFlag', () => {
  it('picks the highest-points flag that has its own text', () => {
    const hits = [hit('RF_URGENCY'), hit('RF_CODE_REQUEST'), hit('RF_THREAT')];
    expect(strongestFlag(hits, () => true)).toBe('RF_CODE_REQUEST');
    expect(strongestFlag(hits, (f) => f !== 'RF_CODE_REQUEST')).toBe('RF_URGENCY');
    expect(strongestFlag([], () => true)).toBeNull();
  });
});

describe('fillAction', () => {
  const action = 'Sunați banca la {official_contact}.';
  const fallback = 'Sunați la numărul de pe spatele cardului.';
  it('fills the catalog phone of the impersonated org', () => {
    expect(fillAction(action, fallback, { org: 'Banca Dunărea', threadText: '' })).toBe('Sunați banca la 0800 100 200.');
  });
  it('falls back when there is no org or the org has no phone', () => {
    expect(fillAction(action, fallback, noCtx)).toBe(fallback);
    expect(fillAction(action, fallback, { org: 'PiațaMea', threadText: '' })).toBe(fallback);
  });
  it('never repeats a number that appears in the message', () => {
    expect(fillAction(action, fallback, { org: 'Banca Dunărea', threadText: 'sunati la 0800-100-200' })).toBe(fallback);
  });
});

describe('buildWarning', () => {
  it('gives a SCAM lead plus one sentence in ro and en, and a filled action', () => {
    const w = buildWarning(
      { verdict: 'SCAM', scamType: 'BANK_IMPERSONATION', hits: [hit('RF_CODE_REQUEST')] },
      { org: 'Banca Dunărea', threadText: 'Banca Dunarea: trimiteti codul' },
    );
    expect(w.ro.startsWith('Atenție, pare o țeapă!')).toBe(true);
    expect(w.en.startsWith('Warning, this looks like a scam!')).toBe(true);
    expect(sentences(`${w.ro} ${w.action}`)).toHaveLength(3);
    expect(w.action).toContain('0800 100 200');
  });

  it('has no lead for SAFE and uses the NONE texts', () => {
    const w = buildWarning({ verdict: 'SAFE', scamType: 'NONE', hits: [] }, noCtx);
    expect(w.ro.startsWith('Atenție')).toBe(false);
    expect(w.action).toBe('Nu este nevoie de nicio acțiune.');
  });

  it('uses OTHER texts when a risky result has no type', () => {
    const w = buildWarning({ verdict: 'SUSPICIOUS', scamType: 'NONE', hits: [hit('RF_URGENCY')] }, noCtx);
    expect(w.ro.startsWith('Atenție, verificați')).toBe(true);
    expect(w.action).not.toContain('{');
  });

  it('never leaves the placeholder in any type, verdict or flag', () => {
    const types = Object.keys(generated.types) as (keyof typeof generated.types)[];
    for (const scamType of types) {
      for (const flag of ['RF_CODE_REQUEST', 'RF_SUSPICIOUS_CONTACT', 'RF_PAYMENT_REQUEST'] as const) {
        const w = buildWarning({ verdict: 'SCAM', scamType, hits: [hit(flag)] }, noCtx);
        expect(`${w.ro}${w.en}${w.action}`, `${scamType}/${flag}`).not.toContain('{');
      }
    }
  });
});
