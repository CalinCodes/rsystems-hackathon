import { describe, expect, it } from 'vitest';
import { moodFor, thiefDataUrl, thiefSvg, type ThiefMood } from './thief';

const MOODS: ThiefMood[] = ['sneak', 'peek', 'caught', 'safe'];

describe('thiefSvg', () => {
  it('draws a different picture for every mood, the same one every time', () => {
    const svgs = MOODS.map(thiefSvg);
    expect(new Set(svgs).size).toBe(MOODS.length);
    for (const m of MOODS) expect(thiefSvg(m)).toBe(thiefSvg(m));
  });
  it('loads nothing from the network: no links, no external images or fonts', () => {
    for (const m of MOODS) {
      const svg = thiefSvg(m).replace('xmlns="http://www.w3.org/2000/svg"', '');
      expect(svg).not.toMatch(/https?:|href|url\(|@import/i);
    }
  });
  it('stops every animation when the system asks for reduced motion', () => {
    expect(thiefSvg('caught')).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}}');
  });
  it('puts the thief behind bars only when caught', () => {
    expect(thiefSvg('caught')).toContain('class="sst-bars"');
    expect(thiefSvg('sneak')).not.toContain('class="sst-bars"');
  });
});

describe('thiefDataUrl / moodFor', () => {
  it('is an SVG data URL that decodes back to the same markup', () => {
    const url = thiefDataUrl('peek');
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(url.split(',')[1] ?? '')).toBe(thiefSvg('peek'));
  });
  it('maps each verdict to its figure', () => {
    expect(moodFor('SCAM')).toBe('caught');
    expect(moodFor('SUSPICIOUS')).toBe('peek');
    expect(moodFor('SAFE')).toBe('safe');
  });
});
