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

## Alert a trusted family member (ntfy, optional)

When a chat turns **SCAM**, the extension sends one alert per chat to a relative's phone through
[ntfy](https://ntfy.sh). By default it uses the public server `https://ntfy.sh`, so it works from any laptop with
the extension and reaches the phone on any network. The alert holds the reader's name, the time and the scam type in
plain words. **No message text, no sender number and no chat name are sent.** SUSPICIOUS does not page anyone.

Anyone who knows the topic can read its alerts, so keep the topic hard to guess. The extension only accepts
`https://ntfy.sh` or a self-hosted server on the local network (192.168.x.x, 10.x.x.x, 172.16–31.x.x, localhost,
`.local`); any other public host is refused.

1. On the relative's phone: install the ntfy app, tap **+**, enter the topic `scamshield-family-676767`
   (leave **Use another server** off) and tap **Subscribe**.
2. On every laptop with the extension: `chrome://extensions` → Scam Shield → **Details** → **Extension options**.
   Server and topic are prefilled. Enter the name ("Mama"), tick **Trimite alerte**, click **Salvează**.
3. **Trimite un test** sends a test alert. From a terminal: `curl -d "test" https://ntfy.sh/scamshield-family-676767`.

When it rings: the chat is SCAM and a new message arrived since the last alert, at most once every 2 minutes per
chat (reopening a chat never rings again). Each detected scam message sends exactly one request, with no retry:
ntfy.sh limits each public IP (60-request burst, then 1 per 5 s, 250 messages a day), and at a venue all laptops share
one IP. HTTP 429 means that allowance is used up: switch to the phone's hotspot or a self-hosted ntfy server. The
options page shows the result of the last attempt. If ntfy.sh is unreachable, the reader still gets the
normal warning. With Wi-Fi off there is no family alert (the detector itself keeps working offline).

## Typing guard

In a chat the engine judged SUSPICIOUS or SCAM, the extension also watches what the **reader** is about to send.
If the draft holds an SMS/app code (4-8 digits), a card number (Luhn-checked), a CNP (control digit checked) or a
remote-control app name with its id ("AnyDesk 123 456 789"), Enter and the send button are stopped and a note
explains why, with the chat's official-channel action. **Nu trimit** is the focused default; **Trimit oricum**
sends that exact draft, because it is the reader's decision. Amounts ("1850 lei"), hours ("12:30") and phone
numbers are not stopped, and SAFE chats are never guarded. The draft is read in memory only: never stored,
logged or sent.

## How it works

| File | Job |
|---|---|
| `src/content.ts` | Runs in the WhatsApp tab and watches the page for changes (debounced 0.8 s). When the open chat changes, it sends that chat to the service worker. |
| `src/dom.ts` | Reads bubbles through `data-pre-plain-text` and `.message-out`. These stay stable when WhatsApp regenerates its class names. |
| `src/thread.ts` | Builds a `Scenario` from the latest 20 messages. Incoming = sender, own = reader. A chat titled with a phone number = unknown sender. WhatsApp's invisible direction marks and no-break spaces are stripped first. |
| `src/banner.ts` | What to show. Risky chat: the engine's warning, plus "Numărul nu este în agenda dumneavoastră" for unknown numbers. Safe chat from an unknown number: a calm grey note (no badge, no notification). Safe chat from a saved contact: nothing. |
| `src/background.ts` | Service worker. Runs `analyze()` with `ml/out/weights.json`, then sets the badge and sends the notification. |
| `src/embedCache.ts` | Embeds only new messages, keyed by a hash rather than the text. After a failed Ollama call it pauses the model for 60 s. |
| `src/pager.ts`, `src/pagerStore.ts`, `src/options.ts` | Family alert: payload (no message text), local-network check, once per chat on SCAM, options page. |
| `src/guard.ts`, `src/guardView.ts` | Typing guard: finds a code, card, CNP or remote-access id in the reader's draft (pure, tested) and stops the send in risky chats. |
| `src/view.ts` | Draws the banner (inline styles, system font, 18 px+) and outlines the first-alert bubble. |

## Privacy

- It reads only the chat on screen. Nothing is stored, and message text is never logged.
- The only network calls are to `http://localhost:11434` (Ollama on this laptop) and, only if you turn the family
  alert on, to ntfy.sh (or your local ntfy server). That alert carries no message text.
- Permissions are limited to `notifications`, `storage`, `web.whatsapp.com`, `localhost:11434` and `ntfy.sh`. A
  local ntfy server is an optional permission, asked for that one address when you save the options.

## Limits

- It reads text messages only. Voice notes, images and stickers are skipped.
- If WhatsApp changes `data-pre-plain-text` or `.message-out`, `dom.ts` needs new selectors.
- In group chats, every other member counts as "sender".
