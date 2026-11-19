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

const READER_LINE = /^eu\s*:\s*/i;

/**
 * Pasted text becomes a thread. A line starting with "Eu:" is the reader's own reply (one line).
 * Other lines are the sender's: they stay in one message until a blank line or an "Eu:" line, so a
 * single pasted message is one message and a pasted conversation keeps its turns. The id is fixed
 * so the same paste always gives the same Result.
 */
export function buildScenario(input: PasteInput): Scenario {
  const messages: Scenario['messages'] = [];
  let sender: string[] = [];
  const add = (from: 'sender' | 'reader', text: string) => {
    if (text !== '') messages.push({ n: messages.length + 1, from, text });
  };
  const flush = () => {
    add('sender', sender.join('\n'));
    sender = [];
  };
  for (const raw of input.text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') flush();
    else if (READER_LINE.test(line)) {
      flush();
      add('reader', line.replace(READER_LINE, '').trim());
    } else sender.push(line);
  }
  flush();
  return {
    id: 'paste',
    channel: input.channel,
    sender: { name: null, address: null, known_contact: input.knownContact },
    messages,
  };
}
