import { useCallback, useEffect, useRef, useState } from 'react';
import { startReplay } from './replay';

const STEP_MS = 1100;

/** `shown` starts at "all messages", so the view opens complete and "Redă conversația" replays it. */
export function useReplay(total: number): { shown: number; playing: boolean; play: () => void } {
  const [shown, setShown] = useState(total);
  const [playing, setPlaying] = useState(false);
  const stop = useRef<() => void>(() => undefined);

  // Leaving the screen must not leave a timer running.
  useEffect(() => () => stop.current(), []);

  const play = useCallback(() => {
    stop.current();
    setPlaying(true);
    stop.current = startReplay(
      total,
      (n) => {
        setShown(n);
        if (n >= total) setPlaying(false);
      },
      STEP_MS,
    );
  }, [total]);

  return { shown, playing, play };
}
