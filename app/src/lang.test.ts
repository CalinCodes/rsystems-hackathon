import { describe, expect, it } from 'vitest';
import { warningParts } from './lang';

const warning = { ro: 'Text român.', en: 'English text.', action: 'Sunați banca.' };

describe('warningParts', () => {
  it('picks the body by language', () => {
    expect(warningParts(warning, 'ro').body).toBe('Text român.');
    expect(warningParts(warning, 'en').body).toBe('English text.');
  });

  it('keeps the action unchanged in both languages', () => {
    expect(warningParts(warning, 'en').action).toBe('Sunați banca.');
    expect(warningParts(warning, 'ro').action).toBe('Sunați banca.');
  });
});
