import { describe, expect, it } from 'vitest';
import { pickLocalRoVoice } from './speech';

const v = (lang: string, localService: boolean, name = `${lang}-${localService}`) => ({ lang, localService, name });

describe('pickLocalRoVoice', () => {
  it('takes a local Romanian voice', () => {
    expect(pickLocalRoVoice([v('en-US', true), v('ro-RO', true)])?.name).toBe('ro-RO-true');
  });

  it('never takes a remote voice, even the only Romanian one', () => {
    expect(pickLocalRoVoice([v('ro-RO', false), v('en-US', true)])).toBeNull();
  });

  it('skips a remote Romanian voice and uses a local one after it', () => {
    expect(pickLocalRoVoice([v('ro-RO', false, 'remote'), v('ro-RO', true, 'local')])?.name).toBe('local');
  });

  it('accepts ro, ro_RO and RO-ro spellings but not other languages that start with ro', () => {
    expect(pickLocalRoVoice([v('ro', true)])).not.toBeNull();
    expect(pickLocalRoVoice([v('ro_RO', true)])).not.toBeNull();
    expect(pickLocalRoVoice([v('RO-ro', true)])).not.toBeNull();
    expect(pickLocalRoVoice([v('rom-XX', true), v('rof', true)])).toBeNull();
  });

  it('gives null when there are no voices', () => {
    expect(pickLocalRoVoice([])).toBeNull();
  });
});
