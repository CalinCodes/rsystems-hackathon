import { describe, expect, it } from 'vitest';
import type { Result } from '@ss/contracts';
import { checkConfig, COOLDOWN_MS, decideAlert, decidePage, EMPTY_PAGER, isLocalHost, pagerPayload, sendPage, type PagerConfig } from './pager';

const cfg: PagerConfig = { enabled: true, server: 'http://192.168.1.20:8090', topic: 'familia-pop-7k2', name: 'Mama' };
const r = (verdict: Result['verdict'], scamType: Result['scamType'] = 'BANK_IMPERSONATION') => ({ verdict, scamType }) as Result;

describe('pager', () => {
  it('accepts only private-network hosts', () => {
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '192.168.1.20', '172.16.0.1', '172.31.255.1', 'laptop.local']) {
      expect(isLocalHost(h), h).toBe(true);
    }
    for (const h of ['ntfy.sh', '8.8.8.8', '172.32.0.1', '192.169.1.1', '999.1.1.1', 'evil.local.com']) {
      expect(isLocalHost(h), h).toBe(false);
    }
  });

  it('accepts ntfy.sh (https only) or a local server, rejects other public hosts', () => {
    expect(checkConfig({ ...cfg, server: 'https://ntfy.sh' })).toEqual({ origin: 'https://ntfy.sh' });
    expect(checkConfig({ ...cfg, server: '' })).toEqual({ origin: 'https://ntfy.sh' });
    expect(checkConfig({ ...cfg, server: 'http://ntfy.sh' })).toEqual({ problem: 'not_local' });
    expect(checkConfig({ ...cfg, server: 'https://ntfy.sh.evil.com' })).toEqual({ problem: 'not_local' });
    expect(checkConfig({ ...cfg, server: 'https://ntfy-sh.com' })).toEqual({ problem: 'not_local' });
  });

  it('defaults to ntfy.sh and the family topic', () => {
    expect([EMPTY_PAGER.server, EMPTY_PAGER.topic, EMPTY_PAGER.enabled]).toEqual(['https://ntfy.sh', 'scamshield-family-676767', false]);
  });

  it('rejects a bad topic and an empty name', () => {
    expect(checkConfig({ ...cfg, topic: 'a b' })).toEqual({ problem: 'topic' });
    expect(checkConfig({ ...cfg, name: ' ' })).toEqual({ problem: 'name' });
    expect(checkConfig({ ...cfg, server: 'ftp://192.168.1.2' })).toEqual({ problem: 'server' });
    expect(checkConfig(cfg)).toEqual({ origin: 'http://192.168.1.20:8090' });
  });

  it('pages on SCAM with a new message, once per cooldown', () => {
    const t = 1_000_000;
    expect(decidePage(undefined, r('SUSPICIOUS'), 'm1', t)).toBe('not_scam');
    expect(decidePage(undefined, r('SCAM'), 'm1', t)).toBe('page');
    const mark = { at: t, msg: 'm1' };
    expect(decidePage(mark, r('SCAM'), 'm1', t + 10 * COOLDOWN_MS)).toBe('not_new'); // chat reopened, nothing new
    expect(decidePage(mark, r('SCAM'), 'm2', t + 1_000)).toBe('cooldown'); // scammer keeps typing
    expect(decidePage(mark, r('SCAM'), 'm2', t + COOLDOWN_MS)).toBe('page'); // a new scam message later
  });

  it('payload has name, time and type in plain words, and nothing from the chat', () => {
    const p = pagerPayload(cfg, r('SCAM'), new Date(2026, 10, 19, 14, 5));
    expect(p.topic).toBe('familia-pop-7k2');
    expect(p.priority).toBe(5);
    expect(String(p.title)).toContain('Mama');
    expect(String(p.message)).toContain('14:05');
    expect(String(p.message)).toContain('bancă falsă');
    expect(Object.keys(p).sort()).toEqual(['message', 'priority', 'tags', 'title', 'topic']);
  });

  it('the test alert uses the same max priority as a real alert', () => {
    expect(pagerPayload(cfg, r('SCAM'), new Date(), true).priority).toBe(5);
  });

  it('POSTs JSON to the server root and throws on HTTP error', async () => {
    const calls: { url: string; body: string }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await sendPage(cfg, r('SCAM'), { fetchImpl: ok });
    expect(calls[0]?.url).toBe('http://192.168.1.20:8090');
    expect(JSON.parse(calls[0]?.body ?? '{}').topic).toBe('familia-pop-7k2');
    const bad = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    await expect(sendPage(cfg, r('SCAM'), { fetchImpl: bad })).rejects.toThrow('ntfy 500');
    await expect(sendPage({ ...cfg, server: 'https://example.com' }, r('SCAM'), { fetchImpl: ok })).rejects.toThrow('not_local');
  });
});

describe('decideAlert', () => {
  const now = 1_000_000;
  it('sends on the first SCAM of a chat when the settings are complete', () => {
    expect(decideAlert(cfg, undefined, r('SCAM'), 'm1', now)).toEqual({ send: true });
  });
  it('reports a scam it could not send because the switch is off or a field is missing', () => {
    expect(decideAlert({ ...cfg, enabled: false }, undefined, r('SCAM'), 'm1', now)).toEqual({ send: false, skipped: 'disabled' });
    expect(decideAlert({ ...cfg, name: '' }, undefined, r('SCAM'), 'm1', now)).toEqual({ send: false, skipped: 'name' });
  });
  it('stays quiet without a report for SUSPICIOUS, an already-paged message, or the cooldown', () => {
    expect(decideAlert(cfg, undefined, r('SUSPICIOUS'), 'm1', now)).toEqual({ send: false, skipped: null });
    expect(decideAlert(cfg, { at: now - 10, msg: 'm1' }, r('SCAM'), 'm1', now)).toEqual({ send: false, skipped: null });
    expect(decideAlert(cfg, { at: now - 10, msg: 'm1' }, r('SCAM'), 'm2', now)).toEqual({ send: false, skipped: null });
    expect(decideAlert(cfg, { at: now - COOLDOWN_MS, msg: 'm1' }, r('SCAM'), 'm2', now)).toEqual({ send: true });
  });
});
