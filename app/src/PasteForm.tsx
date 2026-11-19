import { useState } from 'react';
import type { Channel, Scenario } from '@ss/contracts';
import { ChannelFields } from './ChannelFields';
import { EXAMPLES } from './examples';
import { OpenFileButton } from './OpenFileButton';
import { buildScenario } from './scenario';

interface PasteFormProps {
  busy: boolean;
  onCheck: (s: Scenario) => void;
  onInvalidFile: () => void;
}

const SECONDARY = 'min-h-14 rounded-card border-2 border-ink/30 bg-surface px-5 font-semibold disabled:opacity-50';

export function PasteForm({ busy, onCheck, onInvalidFile }: PasteFormProps) {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<Channel>('sms');
  const [knownContact, setKnownContact] = useState(false);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onCheck(buildScenario({ text, channel, knownContact }));
      }}
    >
      <label className="flex flex-col gap-2 font-heading text-2xl">
        Lipiți aici mesajul primit
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="rounded-card border-2 border-ink/30 bg-surface p-4 font-body text-xl font-normal shadow-soft"
        />
      </label>
      <p className="text-ink/70">
        Pentru o conversație, lipiți toate mesajele. Începeți fiecare răspuns al dumneavoastră cu „Eu:”.
      </p>
      <ChannelFields
        channel={channel}
        knownContact={knownContact}
        onChannel={setChannel}
        onKnownContact={setKnownContact}
      />
      <button
        type="submit"
        disabled={text.trim() === '' || busy}
        className="min-h-20 w-full rounded-card bg-ink px-6 text-2xl font-semibold text-surface shadow-soft disabled:opacity-50"
      >
        Verifică mesajul
      </button>
      <div className="flex flex-wrap gap-3">
        <OpenFileButton disabled={busy} onScenario={onCheck} onInvalid={onInvalidFile} />
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            disabled={busy}
            onClick={() => onCheck(buildScenario(ex.input))}
            className={SECONDARY}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </form>
  );
}
