import type { Hit, Scenario } from '@ss/contracts';
import { motion, useReducedMotion } from 'framer-motion';
import { flagLabel } from './flags';
import { segmentMessage } from './highlight';
import { SPRING } from './motionConfig';

interface ChatThreadProps {
  messages: Scenario['messages'];
  hits: Hit[];
  firstAlert: number | null;
  /** Only the first `visible` messages are drawn: the replay adds them one by one. */
  visible?: number;
}

/** Chat bubbles: sender on the left, reader on the right, both grey. The "why" sits under each bubble. */
export function ChatThread({ messages, hits, firstAlert, visible = messages.length }: ChatThreadProps) {
  const reduce = useReducedMotion();
  return (
    <ol className="flex flex-col gap-5" aria-label="Conversația">
      {messages.slice(0, visible).map((m) => {
        const mine = m.from === 'reader';
        const flags = [...new Set(hits.filter((h) => h.msg === m.n).map((h) => h.flag))];
        const alerted = firstAlert === m.n;
        return (
          <motion.li
            key={m.n}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className={`flex max-w-[88%] flex-col gap-2 ${mine ? 'self-end' : 'self-start'}`}
          >
            {alerted && <p className="font-semibold text-suspicious">⚠ Aici am avertizat</p>}
            <div
              className={`rounded-card p-4 ${mine ? 'bg-ink/15' : 'bg-ink/10'} ${
                alerted ? 'ring-4 ring-suspicious ring-offset-2' : ''
              }`}
            >
              <p className="mb-1 font-semibold">
                [{m.n}] {mine ? 'Dumneavoastră' : 'Expeditor'}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {segmentMessage(m.text, m.n, hits).map((seg, i) =>
                  seg.flag === null ? (
                    <span key={i}>{seg.text}</span>
                  ) : (
                    <mark key={i} title={flagLabel(seg.flag)} className="bg-suspicious/25 font-semibold text-ink underline decoration-2">
                      {seg.text}
                    </mark>
                  ),
                )}
              </p>
            </div>
            {flags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {flags.map((f) => (
                  <li key={f} className="rounded-full border-2 border-suspicious px-3 py-1">
                    {flagLabel(f)}
                  </li>
                ))}
              </ul>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
