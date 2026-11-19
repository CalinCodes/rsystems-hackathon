import type { FlagCode, Hit } from '@ss/contracts';
import { canonicalize } from '@ss/engine';

export interface Segment {
  text: string;
  flag: FlagCode | null;
}

interface Range {
  start: number;
  end: number;
  flag: FlagCode;
}

/**
 * Cut one message into plain and flagged pieces. The engine slices evidence from the CANONICAL
 * text (NFKC, invisible characters removed), so we search that same text: searching the raw
 * paste would miss evidence whenever the sender used tricks such as zero-width characters.
 * Overlapping evidence keeps the earlier piece so the output never repeats a character.
 */
export function segmentMessage(text: string, msg: number, hits: Hit[]): Segment[] {
  const canon = canonicalize(text);
  const found: Range[] = [];
  for (const h of hits) {
    if (h.msg !== msg || h.evidence.length === 0) continue;
    const start = canon.indexOf(h.evidence);
    if (start >= 0) found.push({ start, end: start + h.evidence.length, flag: h.flag });
  }
  found.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of found) {
    if (r.start < cursor) continue;
    if (r.start > cursor) segments.push({ text: canon.slice(cursor, r.start), flag: null });
    segments.push({ text: canon.slice(r.start, r.end), flag: r.flag });
    cursor = r.end;
  }
  if (cursor < canon.length) segments.push({ text: canon.slice(cursor), flag: null });
  return segments;
}
