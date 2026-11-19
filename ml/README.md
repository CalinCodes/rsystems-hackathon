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
| `out/thresholds.json` | Per flag: the probability cut to use, plus the CV precision/recall at that cut | engine, when it turns `predict()` output into `Hit`s |

The embedding cache `out/emb_cache.npz` and `out/dataset.jsonl` are git-ignored.

## Using thresholds.json (for the engine)

A classifier hit adds the flag's full points (15–35), so one false hit can turn a SAFE
message SUSPICIOUS. Each cut is therefore the **lowest probability whose cross-validated
precision is ≥ 0.9**, and it is never below 0.5.

- `p >= threshold` → emit `{ flag, src: 'clf', p }`.
- `threshold: null` → no cut is precise enough. **Ignore the classifier for that flag**
  and rely on rules only. Do not fall back to 0.5.

`thresholds.json` lives outside `weights.json` because the `Weights` type in `contracts/`
is frozen, and `loadWeights()` would drop any extra field.

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

- Use only valid `FlagCode` / `ScamType` values. `generator_test.py` rejects unknown ones and
  unfilled `{slots}`.
- For every scam template, add a SAFE look-alike on the same topic.
- A flag with few templates (see the `tpl` column) generalises poorly: its recall stays low,
  or its cut becomes `null`.
