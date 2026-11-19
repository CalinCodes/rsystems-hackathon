import type { Channel } from '@ss/contracts';
import { CHANNEL_OPTIONS } from './scenario';

interface ChannelFieldsProps {
  channel: Channel;
  knownContact: boolean;
  onChannel: (c: Channel) => void;
  onKnownContact: (v: boolean) => void;
}

/** The two optional details that help the check: where the message came from, and if the sender is known. */
export function ChannelFields({ channel, knownContact, onChannel, onKnownContact }: ChannelFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 font-semibold">
        De unde vine mesajul
        <select
          value={channel}
          onChange={(e) => onChannel(e.target.value as Channel)}
          className="min-h-14 rounded-card border-2 border-ink/30 bg-surface px-4 font-normal"
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-14 items-center gap-4">
        <input
          type="checkbox"
          checked={knownContact}
          onChange={(e) => onKnownContact(e.target.checked)}
          className="size-7"
        />
        Expeditorul este în agenda mea
      </label>
    </div>
  );
}
