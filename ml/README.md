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
| p90 (`thresholds.json`) | 1.2% | 71.8% |
| p80 (`thresholds.p80.json`) | 7.0% | 82.1% |

`thresholds.json` lives outside `weights.json` because the `Weights` type in `contracts/`
is frozen, and `loadWeights()` would drop any extra field.

## Wiring checklist for `analyze()` (engine owner)

This is needed for the AI tier bonus: model, rules, link checks and calibrated cuts together
make tier 6 (+10%). Today `analyze()` ignores `opts.weights`.

1. **Skip when there are no weights.** If `opts.weights` is missing or `flags` is empty (the
   stub), return the rules-only result as today. Fixtures and tests keep working offline.
2. **Embed sender messages only.** `embed(s.messages.filter(m => m.from === 'sender').map(m => m.text))`,
   using the raw text, not `normalizeText`: the training rows keep diacritics and case noise.
   Reader replies never carry flags.
3. **Score each message.** `predict(emb, weights)` returns P per flag. Emit
   `{ flag, msg: m.n, evidence: '', src: 'clf', p }` when `p >= thresholds[flag].threshold`.
   Skip a flag whose threshold is `null`.
4. **Merge with the rule hits** before `scoreThread`. It already counts each flag once at its
   first message, so a rule hit and a clf hit on the same flag don't add up.
5. **Leave scam type to the decision list.** Use the type model at most as a fallback when
   the list says `OTHER` on a non-SAFE result.
6. **Ablation.** In `eval.ts`, load `ml/out/weights.json` instead of the stub, and run once with
   `thresholds.json` and once with `thresholds.p80.json`. Keep whichever scores higher.

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
