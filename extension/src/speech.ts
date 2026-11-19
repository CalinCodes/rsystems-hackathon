export interface VoiceLike {
  lang: string;
  localService: boolean;
}

/**
 * A Romanian voice that runs ON THIS COMPUTER, or null. WHY localService only: Chrome's Google voices send the
 * spoken text to the internet, and the warning can quote the chat. No local voice = no "Ascultați" button.
 * Same rule as the app's `app/src/speech.ts`; copied because the extension does not depend on the app package.
 */
export function pickLocalRoVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  return voices.find((v) => v.localService && /^ro([-_]|$)/i.test(v.lang)) ?? null;
}

/** Slightly slower than normal: easier to follow for older listeners. */
export const SPEECH_RATE = 0.9;

/** The local Romanian voice right now. Chrome fills the list late, so callers ask again when they need it. */
export function localVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  return pickLocalRoVoice(window.speechSynthesis.getVoices());
}

/** Read text aloud, stopping anything still being read. Returns false when no local voice exists. */
export function speak(text: string): boolean {
  const voice = localVoice();
  if (voice === null) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = SPEECH_RATE;
  window.speechSynthesis.speak(u);
  return true;
}

export const stopSpeaking = (): void => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};
