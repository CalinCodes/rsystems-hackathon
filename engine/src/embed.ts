import { EMBED_MODEL } from '@ss/contracts';

/** The one and only network endpoint the app may talk to. */
export const OLLAMA_URL = 'http://localhost:11434';

export interface EmbedOptions {
  /** Injectable so tests never touch the network. */
  fetchImpl?: typeof fetch;
  batchSize?: number;
}

export async function embed(texts: string[], opts: EmbedOptions = {}): Promise<number[][]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const batchSize = opts.batchSize ?? 16;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const res = await doFetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts.slice(i, i + batchSize) }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const data = (await res.json()) as { embeddings: number[][] };
    out.push(...data.embeddings);
  }
  return out;
}
