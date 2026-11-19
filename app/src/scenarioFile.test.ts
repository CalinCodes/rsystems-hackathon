import { describe, expect, it } from 'vitest';
import { parseScenarioJson } from './scenarioFile';

const valid = {
  id: 'T1',
  channel: 'sms',
  sender: { name: 'X', address: null, known_contact: false },
  messages: [{ n: 1, from: 'sender', text: 'Salut' }],
};

describe('parseScenarioJson', () => {
  it('accepts a well-formed scenario', () => {
    const r = parseScenarioJson(JSON.stringify(valid));
    expect(r.ok && r.scenario).toEqual(valid);
  });

  it('fills a missing sender with safe defaults instead of failing', () => {
    const r = parseScenarioJson(JSON.stringify({ ...valid, sender: undefined }));
    expect(r.ok && r.scenario.sender).toEqual({ name: null, address: null, known_contact: false });
  });

  it('numbers messages that have no n', () => {
    const r = parseScenarioJson(JSON.stringify({ ...valid, messages: [{ from: 'sender', text: 'a' }, { from: 'reader', text: 'b' }] }));
    expect(r.ok && r.scenario.messages.map((m) => m.n)).toEqual([1, 2]);
  });

  it.each([
    ['not json', '{oops'],
    ['an array', '[]'],
    ['no id', JSON.stringify({ ...valid, id: '' })],
    ['unknown channel', JSON.stringify({ ...valid, channel: 'fax' })],
    ['no messages', JSON.stringify({ ...valid, messages: [] })],
    ['a bad speaker', JSON.stringify({ ...valid, messages: [{ n: 1, from: 'bot', text: 'a' }] })],
    ['a non-text message', JSON.stringify({ ...valid, messages: [{ n: 1, from: 'sender', text: 5 }] })],
  ])('rejects %s without throwing', (_name, text) => {
    expect(parseScenarioJson(text)).toEqual({ ok: false });
  });
});
