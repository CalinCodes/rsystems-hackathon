import { describe, expect, it } from 'vitest';
import { TRUSTED_KEY, cleanPhone, clearTrusted, readTrusted, saveTrusted, telHref, type StorageLike } from './trusted';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('cleanPhone', () => {
  it('keeps digits and a leading plus, drops separators', () => {
    expect(cleanPhone(' +40 700-000.111 ')).toBe('+40700000111');
    expect(cleanPhone('0700 000 111')).toBe('0700000111');
  });

  it('refuses too short, too long and non-numbers', () => {
    for (const bad of ['', '12345', 'abc', '1'.repeat(16)]) expect(cleanPhone(bad)).toBeNull();
  });

  it('cannot smuggle anything into the tel link', () => {
    expect(telHref(cleanPhone('0700 000 111;rm')!)).toBe('tel:0700000111');
  });
});

describe('trusted person storage', () => {
  it('starts empty, saves, reads back and deletes', () => {
    const s = fakeStorage();
    expect(readTrusted(s)).toBeNull();
    expect(saveTrusted(s, '  Maria  ', '0700 000 111')).toBe(true);
    expect(readTrusted(s)).toEqual({ name: 'Maria', phone: '0700000111' });
    clearTrusted(s);
    expect(readTrusted(s)).toBeNull();
    expect(s.data.size).toBe(0);
  });

  it('saves nothing for an empty name or a bad number', () => {
    const s = fakeStorage();
    expect(saveTrusted(s, '', '0700 000 111')).toBe(false);
    expect(saveTrusted(s, 'Maria', '12')).toBe(false);
    expect(s.data.size).toBe(0);
  });

  it('ignores damaged stored data instead of throwing', () => {
    const s = fakeStorage();
    for (const junk of ['{oops', '5', '"x"', '{"name":1,"phone":2}', '{"name":"","phone":"0700000111"}']) {
      s.setItem(TRUSTED_KEY, junk);
      expect(readTrusted(s)).toBeNull();
    }
  });

  it('survives a browser that refuses to store', () => {
    const s: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(saveTrusted(s, 'Maria', '0700 000 111')).toBe(false);
    expect(() => clearTrusted(s)).not.toThrow();
  });
});
