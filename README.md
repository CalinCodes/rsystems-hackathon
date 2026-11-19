# Scam Shield

Offline app that reads a Romanian message or thread (SMS, WhatsApp, email, chat, call transcript),
detects official red flags, computes a risk score / verdict / scam type / first alert, and shows a
plain-language warning for elderly users. Detection runs 100% locally — the only network calls
allowed at runtime go to Ollama at `http://localhost:11434`.

## Setup

```bash
ollama pull bge-m3
OLLAMA_ORIGINS=http://localhost:5173 ollama serve   # lets the browser app call Ollama
npm i
npm run dev                                         # app on http://localhost:5173
npm test                                            # vitest
npm run eval -- <scenarioFolder> <expected.csv>     # add --twice (determinism) / --ablation
```

Quick check on the bundled fixtures:

```bash
npm run eval -- contracts/fixtures contracts/fixtures/expected.csv
```

## Data

Real validation/test scenarios live **outside** the repo (e.g. `~/scam-data/`). Never copy them in,
and never print message text from eval — only ids, codes and numbers.

## Layout

| Folder       | Package          | Owner                |
|--------------|------------------|----------------------|
| `contracts/` | `@ss/contracts`  | frozen (team decision) |
| `engine/`    | `@ss/engine`     | Claude Code user     |
| `eval/`      | `@ss/eval`       | Claude Code user     |
| `ml/`        | —                | Kiro 1 + Kiro 2      |
| `app/`       | `@ss/app`        | Kiro 2               |

See `CLAUDE.md` for the working rules.
