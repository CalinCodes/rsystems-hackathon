import { EMPTY_PAGER, type PageMark, type PagerConfig } from './pager';

const KEY = 'pager';
const MARKS = 'pagerMarks';
const LAST = 'pagerLast';

/** Settings live in chrome.storage.local on this laptop only; they hold no message content. */
export async function loadPager(): Promise<PagerConfig> {
  const got = await chrome.storage.local.get(KEY);
  const v = got[KEY] as Partial<PagerConfig> | undefined;
  return { ...EMPTY_PAGER, ...(v ?? {}) };
}

export async function savePager(c: PagerConfig): Promise<void> {
  await chrome.storage.local.set({ [KEY]: c });
}

/** Per-chat marks, keyed by the chat's hash. storage.session: survives service-worker restarts, gone when Chrome closes. */
export async function loadMark(chat: string): Promise<PageMark | undefined> {
  const got = await chrome.storage.session.get(MARKS);
  return (got[MARKS] as Record<string, PageMark> | undefined)?.[chat];
}

export async function saveMark(chat: string, mark: PageMark): Promise<void> {
  const got = await chrome.storage.session.get(MARKS);
  const all = { ...((got[MARKS] as Record<string, PageMark> | undefined) ?? {}), [chat]: mark };
  await chrome.storage.session.set({ [MARKS]: all });
}

/** Outcome of the last alert attempt, shown on the options page. Times and codes only, never message text. */
export interface PagerLast {
  at: number;
  outcome: 'sent' | 'failed';
  attempts: number;
  error?: string;
}

export async function saveLast(last: PagerLast): Promise<void> {
  await chrome.storage.local.set({ [LAST]: last });
}

export async function loadLast(): Promise<PagerLast | undefined> {
  const got = await chrome.storage.local.get(LAST);
  return got[LAST] as PagerLast | undefined;
}
