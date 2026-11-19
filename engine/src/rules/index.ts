import type { Hit, Scenario } from '@ss/contracts';
import { codeRequest } from './code';
import { suspiciousContact } from './contact';
import { dataRequest } from './data';
import { newNumber } from './newNumber';
import { paymentRequest } from './payment';
import { remoteAccess } from './remote';
import { buildCtx, type Rule } from './util';

const RULES: Rule[] = [suspiciousContact, codeRequest, remoteAccess, dataRequest, paymentRequest, newNumber];

/** Sorted so the same input always yields hits in the same order (determinism). */
export function runRules(s: Scenario): Hit[] {
  const ctx = buildCtx(s);
  return RULES.flatMap((r) => r(ctx)).sort((a, b) => a.msg - b.msg || a.flag.localeCompare(b.flag) || a.evidence.localeCompare(b.evidence));
}
