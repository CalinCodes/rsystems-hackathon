import { useEffect, useState } from 'react';
import { useLocalVoice } from './useLocalVoice';

/** Reads the warning aloud with a voice on this device. Hidden when there is no such voice. */
export function ReadAloudButton({ text }: { text: string }) {
  const voice = useLocalVoice();
  const [speaking, setSpeaking] = useState(false);

  // Leaving the screen must not leave the voice talking.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (voice === null || text.trim() === '') return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice?.lang ?? 'ro-RO';
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  return (
    <button
      type="button"
      aria-pressed={speaking}
      onClick={toggle}
      className="min-h-14 self-start rounded-card border-2 border-ink/30 bg-surface px-5 text-xl font-semibold"
    >
      <span aria-hidden="true">{speaking ? '■' : '🔊'}</span> {speaking ? 'Oprește' : 'Citește cu voce tare'}
    </button>
  );
}
