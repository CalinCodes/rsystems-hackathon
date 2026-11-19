/** One gentle spring for every entrance and meter move, so the whole app feels the same. */
export const SPRING = { type: 'spring', stiffness: 140, damping: 22 } as const;

/** Shortest time the "Verificăm…" state stays up, so a fast check does not flash. */
export const MIN_THINK_MS = 450;

export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
