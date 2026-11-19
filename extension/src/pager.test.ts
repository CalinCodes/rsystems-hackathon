import { describe, expect, it } from 'vitest';
import type { Result } from '@ss/contracts';
import { checkConfig, isLocalHost, pagerPayload, sendPage, shouldPage, type PagerConfig } from './pager';

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

  it('rejects a public ntfy server, a bad topic and an empty name', () => {
    expect(checkConfig({ ...cfg, server: 'https://ntfy.sh' })).toEqual({ problem: 'not_local' });
    expect(checkConfig({ ...cfg, topic: 'a b' })).toEqual({ problem: 'topic' });
    expect(checkConfig({ ...cfg, name: ' ' })).toEqual({ problem: 'name' });
    expect(checkConfig({ ...cfg, server: 'ftp://192.168.1.2' })).toEqual({ problem: 'server' });
    expect(checkConfig(cfg)).toEqual({ origin: 'http://192.168.1.20:8090' });
  });

  it('pages only on SCAM, once per chat', () => {
    const paged = new Set<string>();
    expect(shouldPage(paged, 'A', r('SUSPICIOUS'))).toBe(false);
    expect(shouldPage(paged, 'A', r('SAFE'))).toBe(false);
    expect(shouldPage(paged, 'A', r('SCAM'))).toBe(true);
    paged.add('A');
    expect(shouldPage(paged, 'A', r('SCAM'))).toBe(false);
    expect(shouldPage(paged, 'B', r('SCAM'))).toBe(true);
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
    await expect(sendPage({ ...cfg, server: 'https://ntfy.sh' }, r('SCAM'), { fetchImpl: ok })).rejects.toThrow('not_local');
  });
});
