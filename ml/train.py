"""Classifier training (owner: Kiro 1).

Steps:
  1. Read ml/out/dataset.jsonl.
  2. Embed texts via Ollama POST http://localhost:11434/api/embed (model "bge-m3", batched).
  3. Hold out 15% BY template_id (never random rows — avoids template leakage: rows
     from one template are near-duplicates, so a random split would put almost-copies
     on both sides and inflate the scores).
  4. Train one LogisticRegression(class_weight='balanced') per flag + one multinomial
     model for scam type.
  5. Print per-flag precision/recall on the held-out set.
  6. Export ml/out/weights.json matching contracts/types.ts `Weights`.

The exported shape must stay in lockstep with engine/src/classifier.ts:
  predict()  does sigmoid(w · emb + b) per flag  -> flags[f] = {w: coef_[0], b: intercept_[0]}
  type is a softmax over classes                 -> type = {classes, W: coef_, b: intercept_}

random_state=42 everywhere.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import requests
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_fscore_support

SEED = 42
EMBED_MODEL = "bge-m3"
EMBED_DIM = 1024
OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"
BATCH = 32
HOLDOUT_FRAC = 0.15

HERE = Path(__file__).resolve().parent
DATASET_PATH = HERE / "out" / "dataset.jsonl"
WEIGHTS_PATH = HERE / "out" / "weights.json"

# Must equal ALL_FLAGS in contracts/constants.ts.
ALL_FLAGS = [
    "RF_CODE_REQUEST", "RF_REMOTE_ACCESS", "RF_DATA_REQUEST", "RF_PAYMENT_REQUEST",
    "RF_SUSPICIOUS_CONTACT", "RF_NEW_NUMBER", "RF_SECRECY", "RF_TOO_GOOD",
    "RF_IMPERSONATION", "RF_URGENCY", "RF_THREAT", "RF_EMOTIONAL_PRESSURE",
    "RF_CHANNEL_SWITCH",
]


def load_rows() -> list[dict]:
    if not DATASET_PATH.exists():
        sys.exit(f"missing {DATASET_PATH}; run generator.py first")
    with DATASET_PATH.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def embed(texts: list[str]) -> np.ndarray:
    """Batched Ollama embeddings. The only network call this script makes."""
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        chunk = texts[i : i + BATCH]
        res = requests.post(
            OLLAMA_EMBED_URL,
            json={"model": EMBED_MODEL, "input": chunk},
            timeout=120,
        )
        res.raise_for_status()
        out.extend(res.json()["embeddings"])
    arr = np.asarray(out, dtype=np.float64)
    if arr.shape[1] != EMBED_DIM:
        sys.exit(f"embedding dim {arr.shape[1]} != contract dim {EMBED_DIM}")
    return arr


def split_by_template(rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """Hold out whole templates, not rows. Deterministic: sort ids, then take a
    seeded sample so the same templates land in holdout on every run."""
    template_ids = sorted({r["template_id"] for r in rows})
    rng = np.random.RandomState(SEED)
    n_hold = max(1, round(len(template_ids) * HOLDOUT_FRAC))
    held = set(rng.choice(template_ids, size=n_hold, replace=False).tolist())
    is_train = np.array([r["template_id"] not in held for r in rows])
    return is_train, ~is_train


def train_flag(flag: str, X_tr, y_tr, X_te, y_te) -> dict | None:
    """One binary LogisticRegression for a flag. Skip flags with one class in train
    (no bank/courier template carries, e.g., RF_EMOTIONAL_PRESSURE): predict() scores
    a missing flag as 0 and the rule engine covers it."""
    if len(np.unique(y_tr)) < 2:
        print(f"  {flag:24s} skipped (single class in train)")
        return None
    clf = LogisticRegression(
        class_weight="balanced", max_iter=1000, random_state=SEED
    )
    clf.fit(X_tr, y_tr)
    if y_te.sum() and len(np.unique(y_te)) > 1:
        pred = clf.predict(X_te)
        p, r, _, _ = precision_recall_fscore_support(
            y_te, pred, average="binary", zero_division=0
        )
        print(f"  {flag:24s} precision={p:.2f} recall={r:.2f} (pos={int(y_te.sum())})")
    else:
        print(f"  {flag:24s} no positive holdout rows")
    return {"w": clf.coef_[0].tolist(), "b": float(clf.intercept_[0])}


def train_type(X_tr, types_tr, X_te, types_te) -> dict | None:
    classes = sorted(set(types_tr))
    if len(classes) < 2:
        return None
    clf = LogisticRegression(
        class_weight="balanced", max_iter=1000, random_state=SEED
    )
    clf.fit(X_tr, types_tr)
    if len(types_te):
        acc = float((clf.predict(X_te) == np.asarray(types_te)).mean())
        print(f"  TYPE accuracy={acc:.2f} over {len(classes)} classes")
    order = clf.classes_.tolist()
    W, b = clf.coef_, clf.intercept_
    if len(order) == 2:
        # Binary sklearn keeps one row. Softmax over [0, z] equals sigmoid(z),
        # so a zero row for class 0 gives the engine one row per class.
        W = np.vstack([np.zeros_like(W[0]), W[0]])
        b = np.array([0.0, b[0]])
    return {"classes": order, "W": W.tolist(), "b": b.tolist()}


def main() -> None:
    rows = load_rows()
    print(f"loaded {len(rows)} rows, embedding via Ollama...")
    X = embed([r["text"] for r in rows])
    tr, te = split_by_template(rows)
    X_tr, X_te = X[tr], X[te]
    print(f"train={tr.sum()} holdout={te.sum()} (split by template_id)\n")

    flags: dict[str, dict] = {}
    print("per-flag metrics:")
    for flag in ALL_FLAGS:
        y = np.array([1 if flag in r["flags"] else 0 for r in rows])
        model = train_flag(flag, X_tr, y[tr], X_te, y[te])
        if model is not None:
            flags[flag] = model

    print("\ntype model:")
    types = [r["type"] for r in rows]
    type_model = train_type(
        X_tr, [types[i] for i in np.where(tr)[0]],
        X_te, [types[i] for i in np.where(te)[0]],
    )

    weights = {"model": EMBED_MODEL, "dim": EMBED_DIM, "flags": flags, "type": type_model}
    WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS_PATH.write_text(json.dumps(weights), encoding="utf-8")
    print(f"\nwrote {WEIGHTS_PATH} ({len(flags)} flags, type={'yes' if type_model else 'no'})")


if __name__ == "__main__":
    main()
