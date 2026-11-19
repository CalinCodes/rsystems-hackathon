import { useState } from 'react';
import type { Channel } from '@ss/contracts';
import { EXAMPLES } from './examples';
import { CHANNEL_OPTIONS, type PasteInput } from './scenario';

interface PasteFormProps {
  busy: boolean;
  onSubmit: (input: PasteInput) => void;
}

const BUTTON = 'min-h-12 rounded-card border-2 px-4 font-semibold disabled:opacity-50';

export function PasteForm({ busy, onSubmit }: PasteFormProps) {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<Channel>('sms');
  const [knownContact, setKnownContact] = useState(false);
  const empty = text.trim() === '';

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ text, channel, knownContact });
      }}
    >
      <label className="flex flex-col gap-1 font-semibold">
        Lipiți aici mesajul primit
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="rounded-card border-2 border-ink/30 bg-surface p-3 font-normal"
        />
      </label>
      <p className="text-sm">Pentru o conversație, lăsați un rând gol între mesaje. Începeți răspunsul dumneavoastră cu „Eu:”.</p>
      <label className="flex flex-col gap-1 font-semibold">
        De unde vine mesajul
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className="min-h-12 rounded-card border-2 border-ink/30 bg-surface px-3 font-normal"
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={knownContact}
          onChange={(e) => setKnownContact(e.target.checked)}
          className="size-6"
        />
        Expeditorul este în agenda telefonului dumneavoastră
      </label>
      <button type="submit" disabled={empty || busy} className={`${BUTTON} border-ink bg-ink text-surface`}>
        {busy ? 'Se verifică…' : 'Verifică mesajul'}
      </button>
      <div className="flex flex-wrap gap-2" aria-label="Exemple">
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" disabled={busy} onClick={() => onSubmit(ex.input)} className={`${BUTTON} border-ink/30 bg-surface`}>
            {ex.label}
          </button>
        ))}
      </div>
    </form>
  );
}
