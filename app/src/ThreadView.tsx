import type { Hit, Scenario } from '@ss/contracts';
import { flagLabel } from './flags';
import { segmentMessage } from './highlight';

interface ThreadViewProps {
  messages: Scenario['messages'];
  hits: Hit[];
}

/** Each message with the words that raised a flag underlined, then one plain-language note per flag. */
export function ThreadView({ messages, hits }: ThreadViewProps) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Mesajele analizate">
      {messages.map((m) => {
        const flags = [...new Set(hits.filter((h) => h.msg === m.n).map((h) => h.flag))];
        return (
          <li key={m.n} className="rounded-card border border-ink/20 bg-surface p-3">
            <p className="font-semibold">
              {m.n}. {m.from === 'reader' ? 'Dumneavoastră' : 'Expeditor'}
            </p>
            <p className="whitespace-pre-wrap">
              {segmentMessage(m.text, m.n, hits).map((seg, i) =>
                seg.flag === null ? (
                  <span key={i}>{seg.text}</span>
                ) : (
                  <mark
                    key={i}
                    title={flagLabel(seg.flag)}
                    className="bg-suspicious/25 font-semibold text-ink underline decoration-2"
                  >
                    {seg.text}
                  </mark>
                ),
              )}
            </p>
            {flags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {flags.map((f) => (
                  <li key={f} className="rounded-full border border-suspicious px-3 py-1">
                    {flagLabel(f)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
