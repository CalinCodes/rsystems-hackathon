import { EMPTY_PAGER, type PagerConfig } from './pager';

const KEY = 'pager';

/** Settings live in chrome.storage.local on this laptop only; they hold no message content. */
export async function loadPager(): Promise<PagerConfig> {
  const got = await chrome.storage.local.get(KEY);
  const v = got[KEY] as Partial<PagerConfig> | undefined;
  return { ...EMPTY_PAGER, ...(v ?? {}) };
}

export async function savePager(c: PagerConfig): Promise<void> {
  await chrome.storage.local.set({ [KEY]: c });
}
