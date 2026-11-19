import { expect, it } from 'vitest';
import { normalizeText, stripDiacritics } from './normalize';

it('strips Romanian diacritics, both comma and cedilla forms', () => {
  expect(stripDiacritics('ăâîșşțţ')).toBe('aaisstt');
});

it('lowercases before stripping', () => {
  expect(normalizeText('ȘTEFĂNIȚĂ Îți')).toBe('stefanita iti');
});

import { extractAmounts, extractCodes, extractEmails, extractPhones, extractUrls } from './normalize';

it('extracts urls but not email domains, trimming punctuation', () => {
  expect(extractUrls('Accesați https://banca-x.example/abc. sau bancadunarea.ro, ok')).toEqual([
    'https://banca-x.example/abc',
    'bancadunarea.ro',
  ]);
  expect(extractUrls('scrie la ajutor@bancadunarea.ro')).toEqual([]);
});

it('extracts emails', () => {
  expect(extractEmails('a.b@megashop.ro si x@y.com')).toEqual(['a.b@megashop.ro', 'x@y.com']);
});

it('normalizes phone numbers to national form', () => {
  expect(extractPhones('+40 700 000 111, 0700-000-222 si 0800 100 200')).toEqual([
    '0700000111',
    '0700000222',
    '0800100200',
  ]);
});

it('parses Romanian amounts', () => {
  expect(extractAmounts('2.500 lei, 9,99 RON si 150 euro').map((a) => [a.value, a.currency])).toEqual([
    [2500, 'RON'],
    [9.99, 'RON'],
    [150, 'EUR'],
  ]);
});

it('finds OTP-like codes but not phones or amounts', () => {
  expect(extractCodes('Codul este 483920. Sunați 0800 100 200, plătiți 2.500 lei')).toEqual(['483920']);
  expect(extractCodes('fără cod')).toEqual([]);
});

it('does not let an email-looking userinfo hide a link', () => {
  expect(extractUrls('Intrați: https://bancadunarea.ro@evil.xyz/login')).toEqual(['https://bancadunarea.ro@evil.xyz/login']);
});
