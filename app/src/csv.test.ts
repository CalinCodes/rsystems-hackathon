import { readFileSync } from 'node:fs';
import type { Result } from '@ss/contracts';
import mock from '@ss/contracts/mock-results.json';
import { describe, expect, it } from 'vitest';
import { CSV_HEADER, toCsv, uniqueFlags } from './csv';

const results = mock as Result[];
const expected = readFileSync(new URL('../../contracts/fixtures/expected.csv', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => l !== '');
const byId = (id: string) => results.find((r) => r.id === id) as Result;

describe('toCsv', () => {
  it('uses the exact header of the expected-results CSV', () => {
    expect(CSV_HEADER).toBe(expected[0]);
  });

  it('writes a scam row exactly like the expected-results file (flags joined with ";")', () => {
    expect(toCsv([byId('F01')]).split('\n')[1]).toBe(expected.find((l) => l.startsWith('F01,')));
  });

  it('leaves first_alert and red_flags empty for a safe message', () => {
    expect(toCsv([byId('F03')]).split('\n')[1]).toBe(expected.find((l) => l.startsWith('F03,')));
  });

  it('lists each flag once, in the order found', () => {
    const r = { ...byId('F01'), hits: [...byId('F01').hits, ...byId('F01').hits] };
    expect(uniqueFlags(r)).toEqual(['RF_NEW_NUMBER', 'RF_PAYMENT_REQUEST', 'RF_URGENCY', 'RF_SECRECY']);
  });

  it('quotes an id that would break the columns', () => {
    expect(toCsv([{ ...byId('F03'), id: 'a,"b"' }]).split('\n')[1]).toMatch(/^"a,""b""",SAFE,/);
  });

  it('ends with a newline and has only the header for no results', () => {
    expect(toCsv([])).toBe(`${CSV_HEADER}\n`);
  });
});
