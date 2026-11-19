import type { Channel, Scenario } from '@ss/contracts';

export interface PasteInput {
  text: string;
  channel: Channel;
  knownContact: boolean;
}

export const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'chat', label: 'Chat' },
  { value: 'call_transcript', label: 'Convorbire telefonică' },
];

const READER_PREFIX = /^eu\s*:\s*/i;

/**
 * One pasted box becomes a thread: a blank line separates messages, and a paragraph that starts
 * with "Eu:" is the reader's own reply. The id is fixed so the same paste always gives the same Result.
 */
export function buildScenario(input: PasteInput): Scenario {
  const parts = input.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return {
    id: 'paste',
    channel: input.channel,
    sender: { name: null, address: null, known_contact: input.knownContact },
    messages: parts.map((part, i) => {
      const fromReader = READER_PREFIX.test(part);
      return {
        n: i + 1,
        from: fromReader ? 'reader' : 'sender',
        text: fromReader ? part.replace(READER_PREFIX, '') : part,
      };
    }),
  };
}
