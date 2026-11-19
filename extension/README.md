# Scam Shield for WhatsApp Web (Chrome extension)

Reads the chat that is open in `web.whatsapp.com` and runs the same engine as the app on it
(`@ss/engine`: the same rules, scores, first alert and warnings). It shows a warning at the top of the page,
outlines the message where the alert starts, sets a red or amber `!` on the extension icon, and sends one
Chrome notification per chat and verdict.

## Install (once)

```bash
npm run build:extension
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick `extension/dist`.
3. Open `web.whatsapp.com` and open a chat.

After changing code, rerun the build and click the reload arrow on the extension card.

## Turn on the AI model (optional)

Ollama refuses calls from extensions by default (HTTP 403). The extension then uses **rules only**, which still
gives a full verdict, and the banner footer says "cu reguli". To let it use the local model too:

```bash
sudo systemctl edit ollama
# add these two lines, then save:
# [Service]
# Environment="OLLAMA_ORIGINS=http://localhost:5173,chrome-extension://*"
sudo systemctl restart ollama
```

The banner footer then says "cu reguli și model AI local".

## How it works

| File | Job |
|---|---|
| `src/content.ts` | Runs in the WhatsApp tab and watches the page for changes (debounced 0.8 s). When the open chat changes, it sends that chat to the service worker. |
| `src/dom.ts` | Reads bubbles through `data-pre-plain-text` and `.message-out`. These stay stable when WhatsApp regenerates its class names. |
| `src/thread.ts` | Builds a `Scenario` from the latest 20 messages. Incoming = sender, own = reader. A chat titled with a phone number = unknown sender. WhatsApp's invisible direction marks and no-break spaces are stripped first. |
| `src/banner.ts` | What to show. Risky chat: the engine's warning, plus "Numărul nu este în agenda dumneavoastră" for unknown numbers. Safe chat from an unknown number: a calm grey note (no badge, no notification). Safe chat from a saved contact: nothing. |
| `src/background.ts` | Service worker. Runs `analyze()` with `ml/out/weights.json`, then sets the badge and sends the notification. |
| `src/embedCache.ts` | Embeds only new messages, keyed by a hash rather than the text. After a failed Ollama call it pauses the model for 60 s. |
| `src/view.ts` | Draws the banner (inline styles, system font, 18 px+) and outlines the first-alert bubble. |

## Privacy

- It reads only the chat on screen. Nothing is stored, and message text is never logged.
- The only network call is to `http://localhost:11434` (Ollama on this laptop).
- Permissions are limited to `notifications`, `web.whatsapp.com` and `localhost:11434`.

## Limits

- It reads text messages only. Voice notes, images and stickers are skipped.
- If WhatsApp changes `data-pre-plain-text` or `.message-out`, `dom.ts` needs new selectors.
- In group chats, every other member counts as "sender".
