# ml — synthetic data + classifier (Kiro 1 + Kiro 2)

```bash
cd ml
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python generator.py   # templates/*.yaml + slots.yaml -> out/dataset.jsonl
.venv/bin/python train.py       # needs Ollama + bge-m3 on localhost:11434
.venv/bin/python -m pytest -q   # no network
```

`train.py` writes two tracked files:

| File | Contents | Reader |
|---|---|---|
| `out/weights.json` | `Weights` contract: per-flag logistic weights + softmax type model, trained on all rows | `loadWeights()` / `predict()` |
| `out/thresholds.json` | Per flag: the probability cut to use (CV precision ≥ 0.9), plus precision/recall at that cut | engine, when it turns `predict()` output into `Hit`s |
| `out/thresholds.p80.json` | Same format, but with cuts at CV precision ≥ 0.8: more flags fire and there are more false alarms | engine, as the alternative set to compare |

The embedding cache `out/emb_cache.npz` and `out/dataset.jsonl` are git-ignored.

## Using thresholds.json (for the engine)

A classifier hit adds the flag's full points (15–35), so one false hit can turn a SAFE
message SUSPICIOUS. Each cut is therefore the **lowest probability whose cross-validated
precision is ≥ 0.9**, and it is never below 0.5.

- `p >= threshold` → emit `{ flag, src: 'clf', p }`.
- `threshold: null` → no cut is precise enough. **Ignore the classifier for that flag**
  and rely on rules only. Do not fall back to 0.5.

**Which set to use.** The brief's scoring costs about 10 points for a missed scam and about
5 for a false alarm on a SAFE message. Run the validation eval once with each file, using
`--ablation`, and keep the set that scores higher. The sets differ on synthetic data:

| Set | SAFE rows with a false flag | Flagged rows caught |
|---|---|---|
| p90 (`thresholds.json`) | 1.1% | 56.1% |
| p80 (`thresholds.p80.json`) | 5.0% | 75.3% |

`RF_PAYMENT_REQUEST` is set to rules only in both sets (`RULES_ONLY` in `train.py`). On the hand-written threads and on
a blind stress set, the model fired "payment" on investment and job pitches that asked for nothing. That moved the
first alert too early or turned SUSPICIOUS into SCAM. The payment rules already catch real asks.

`thresholds.json` lives outside `weights.json` because the `Weights` type in `contracts/`
is frozen, and `loadWeights()` would drop any extra field.

## How the engine uses it (`engine/src/clf.ts`)

Rules, the model, link checks and calibrated cuts together make AI tier 6 (+10%).

- `analyze(s, { weights })` embeds each **sender** message. It sends the raw text, because
  training rows keep diacritics and case noise. Reader replies are never embedded.
- A `{ flag, msg, evidence: '', src: 'clf', p }` hit is added when `p >= threshold`. A flag
  whose threshold is `null` is skipped. `scoreThread` counts each flag once, at its first message,
  so a rule hit and a clf hit on the same flag don't add up.
- With no weights or the empty stub, it is rules only, so tests and fixtures stay offline. If
  Ollama is down, it is also rules only, and `timingsMs.clfUnavailable = 1`.
- Scam type stays with the rule decision list. The type model is not used at runtime.
- The default cut set is `thresholds.json`; pass `{ thresholds }` to override it.
  `npm run eval -- <folder> <csv> --ablation` runs rules only, p90 and p80 side by side, and lists
  the flags the model added per id.

Checked facts:
- bge-m3 through Ollama is bit-stable: the same text gives the same vector, alone or in any
  batch order (max difference 0.0). The clf path keeps the "same input, same Result" rule.
- Ollama answers CORS for `http://localhost:5173`, so the browser app can call it as is.

## How the numbers are measured

5-fold cross-validation **grouped by `template_id`**: each template is held out once, and
rows from one template never sit on both sides. The scores show how well the model handles
wording it has *not* seen, which is the real-world case. A random row split would only
measure memorised templates.

`train.py` also prints the **SAFE false-alarm rate**: the share of `type: NONE` rows where
any flag fires at its cut. It is the main number to keep low. When it rises, look at the
`safeFA` column to find the flag, then add SAFE hard negatives (messages that mention money,
codes or links but ask for nothing).

## Adding templates

`templates/kiro1_threads.yaml` holds single messages as they appear *inside* a thread:
calm openers, reader replies, call-transcript lines, and the hook. Each message carries only
its own flags, and openers carry none, so the classifier fires at the hook and not at the
greeting. That is what `first_alert` is scored on.

- Never copy validation or test scenario text into templates. Doing so makes the validation
  check meaningless.
- `official_link` must stay a subset of the `contracts/catalog.json` sites. `generator_test.py`
  checks this.

- Use only valid `FlagCode` / `ScamType` values. `generator_test.py` rejects unknown ones and
  unfilled `{slots}`.
- For every scam template, add a SAFE look-alike on the same topic.
- A flag with few templates (see the `tpl` column) generalises poorly: its recall stays low,
  or its cut becomes `null`.
