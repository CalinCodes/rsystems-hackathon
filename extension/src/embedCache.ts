import { threadKey } from './thread';

type Embed = (texts: string[]) => Promise<number[][]>;

const MAX_ENTRIES = 300;
/** After a failed call (Ollama off or refusing the extension), skip the model this long instead of retrying per message. */
export const RETRY_AFTER_MS = 60_000;

/**
 * Re-analysing a chat re-sends every message, so vectors are cached by a hash of the text (never the text
 * itself) and only new messages are embedded. Memory only: the cache dies with the service worker.
 */
export function cachedEmbed(inner: Embed, now: () => number = Date.now): Embed {
  const cache = new Map<string, number[]>();
  let failedAt = -Infinity;
  return async (texts) => {
    if (now() - failedAt < RETRY_AFTER_MS) throw new Error('embedder recently unavailable');
    const keys = texts.map((t) => threadKey('', [{ outgoing: false, text: t }]));
    const missing = [...new Set(texts.filter((_, i) => !cache.has(keys[i] ?? '')))];
    if (missing.length > 0) {
      let vecs: number[][];
      try {
        vecs = await inner(missing);
      } catch (e) {
        failedAt = now();
        throw e;
      }
      missing.forEach((t, i) => {
        const v = vecs[i];
        if (v) cache.set(threadKey('', [{ outgoing: false, text: t }]), v);
      });
      while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value ?? '');
    }
    return keys.map((k) => cache.get(k) ?? []);
  };
}
