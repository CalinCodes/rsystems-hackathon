import { expect, it } from 'vitest';
import { normalizeText, stripDiacritics } from './normalize';

it('strips Romanian diacritics, both comma and cedilla forms', () => {
  expect(stripDiacritics('ăâîșşțţ')).toBe('aaisstt');
});

it('lowercases before stripping', () => {
  expect(normalizeText('ȘTEFĂNIȚĂ Îți')).toBe('stefanita iti');
});
