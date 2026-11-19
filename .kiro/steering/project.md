# Scam Shield — project rules

- Folder ownership: `contracts/` frozen (team decision to change); `engine/` + `eval/` = Claude Code user;
  `ml/` = Kiro 1 + Kiro 2; `app/` = Kiro 2. Do not edit folders you don't own.
- Runtime network: only `localhost:11434` (Ollama). No cloud AI calls, no telemetry, no CDN fonts at
  runtime (self-host fonts via `@fontsource`).
- Never read, open, or request validation/test scenario files; they live outside the repo.
  Eval output must never print message text.
- Deterministic: same input → same Result. No randomness at runtime; seed=42 in ml.
- TS strict, no `any`, named exports, functional components < 80 lines, comments explain WHY,
  tests co-located. Tailwind v4 syntax only (no `tailwind.config.js`).
- Warnings: Romanian first, formal "dumneavoastră", max 3 short sentences, no jargon, exactly one
  action via an OFFICIAL channel from `contracts/catalog.json`; never repeat a link/number from the message.
- Small tasks: one function + its test per change. Merge to main only if `npm test` and `npm run eval`
  on fixtures pass.
