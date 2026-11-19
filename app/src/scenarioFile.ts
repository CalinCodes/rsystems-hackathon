import type { Channel, Scenario } from '@ss/contracts';

const CHANNELS: readonly string[] = ['sms', 'whatsapp', 'email', 'chat', 'call_transcript'];

export type ParsedScenario = { ok: true; scenario: Scenario } | { ok: false };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const orNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function readMessages(raw: unknown): Scenario['messages'] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: Scenario['messages'] = [];
  for (const [i, m] of raw.entries()) {
    if (!isRecord(m) || typeof m.text !== 'string') return null;
    if (m.from !== 'sender' && m.from !== 'reader') return null;
    out.push({ n: typeof m.n === 'number' ? m.n : i + 1, from: m.from, text: m.text });
  }
  return out;
}

/**
 * Turns the text of one .json file into a Scenario, or says it is not one. Never throws and never
 * echoes the content: a bad file must show a friendly row, not crash the page or leak text.
 */
export function parseScenarioJson(text: string): ParsedScenario {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  if (!isRecord(data) || typeof data.id !== 'string' || data.id === '') return { ok: false };
  if (typeof data.channel !== 'string' || !CHANNELS.includes(data.channel)) return { ok: false };
  const messages = readMessages(data.messages);
  if (messages === null) return { ok: false };
  const sender = isRecord(data.sender) ? data.sender : {};
  return {
    ok: true,
    scenario: {
      id: data.id,
      channel: data.channel as Channel,
      sender: {
        name: orNull(sender.name),
        address: orNull(sender.address),
        known_contact: sender.known_contact === true,
      },
      messages,
    },
  };
}
