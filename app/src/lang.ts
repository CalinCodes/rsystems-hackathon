import type { Result } from '@ss/contracts';

export type Lang = 'ro' | 'en';

export const LANG_LABEL: Record<Lang, string> = { ro: 'Română', en: 'English' };

/**
 * The warning body follows the chosen language. The action stays Romanian: it names an official
 * Romanian phone number or site, and Result.warning has a single action field.
 */
export function warningParts(
  warning: Result['warning'],
  lang: Lang,
): { body: string; action: string } {
  return { body: lang === 'ro' ? warning.ro : warning.en, action: warning.action };
}
