import { useEffect, useState } from 'react';
import { pickLocalRoVoice } from './speech';

/** The local Romanian voice, or null (no speech support, or only remote voices). */
export function useLocalVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const read = () => setVoice(pickLocalRoVoice(synth.getVoices()));
    read();
    // Browsers load the voice list late, so listen for it.
    synth.addEventListener('voiceschanged', read);
    return () => synth.removeEventListener('voiceschanged', read);
  }, []);

  return voice;
}
