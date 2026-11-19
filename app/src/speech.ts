export interface VoiceLike {
  lang: string;
  localService: boolean;
}

const isRomanian = (lang: string): boolean => /^ro([-_]|$)/i.test(lang);

/**
 * A Romanian voice that runs ON THIS DEVICE, or null. WHY localService only: a remote voice (for
 * example Chrome's Google voices) sends the spoken text to the internet, which the privacy rule
 * forbids. With no local Romanian voice the read-aloud button is hidden instead of falling back.
 */
export function pickLocalRoVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  return voices.find((v) => v.localService && isRomanian(v.lang)) ?? null;
}
