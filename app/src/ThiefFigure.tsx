import { useMemo } from 'react';
import { thiefDataUrl, type ThiefMood } from './thief';

interface ThiefFigureProps {
  mood: ThiefMood;
  /** Size and placement only (for example `size-24`); the picture scales to fit. */
  className?: string;
}

/** The mascot. Decoration only: hidden from screen readers, because the words next to it carry the meaning. */
export function ThiefFigure({ mood, className = '' }: ThiefFigureProps) {
  const src = useMemo(() => thiefDataUrl(mood), [mood]);
  return <img src={src} alt="" aria-hidden="true" draggable={false} className={`select-none ${className}`} />;
}
