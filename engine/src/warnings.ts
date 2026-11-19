import type { Result } from '@ss/contracts';

// STUB: real builder must follow the warning rules in CLAUDE.md (max 3 short sentences,
// one official action from catalog.json, never echo links/numbers from the message).
export function buildWarning(_result: Omit<Result, 'warning'>): Result['warning'] {
  return { ro: '(avertisment în lucru)', en: '(warning pending)', action: '' };
}
