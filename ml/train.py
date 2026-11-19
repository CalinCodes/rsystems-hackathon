"""Classifier training (owner: Kiro 1).

Steps:
  1. Read ml/out/dataset.jsonl.
  2. Embed texts via Ollama POST http://localhost:11434/api/embed (model "bge-m3", batched),
     cached in ml/out/emb_cache.npz so reruns don't re-embed unchanged text.
  3. Score with 5-fold cross-validation GROUPED BY template_id. Rows from one template are
     near-duplicates, so a random split would put almost-copies on both sides and
     inflate the scores. Every template is held out exactly once, so every flag gets a
     real estimate (a single 15% holdout left most flags with no positive test rows).
  4. From the out-of-fold probabilities, pick per flag the lowest cut whose precision
     is >= MIN_PRECISION. WHY precision first: a classifier hit adds 15-35 points, so
     one false flag can push a SAFE message to SUSPICIOUS and scare the reader.
     Written to ml/out/thresholds.json (not weights.json: the Weights contract is frozen).
  5. Train the final per-flag and type models on ALL rows and export ml/out/weights.json.

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
from sklearn.model_selection import GroupKFold

SEED = 42
EMBED_MODEL = "bge-m3"
EMBED_DIM = 1024
OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"
BATCH = 32
N_FOLDS = 5
MIN_PRECISION = 0.9
# A missed scam costs the team about twice what a false alarm does (brief scoring),
# so a looser cut set is exported too; the engine's validation eval picks one.
LOOSE_PRECISION = 0.8
# Cuts below 0.5 are never offered: they would fire on coin-flip outputs.
CUT_GRID = [round(0.5 + 0.01 * i, 2) for i in range(50)]

HERE = Path(__file__).resolve().parent
DATASET_PATH = HERE / "out" / "dataset.jsonl"
WEIGHTS_PATH = HERE / "out" / "weights.json"
THRESHOLDS_PATH = HERE / "out" / "thresholds.json"
THRESHOLDS_LOOSE_PATH = HERE / "out" / "thresholds.p80.json"
CACHE_PATH = HERE / "out" / "emb_cache.npz"

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
        res = requests.post(
            OLLAMA_EMBED_URL,
            json={"model": EMBED_MODEL, "input": texts[i : i + BATCH]},
            timeout=120,
        )
        res.raise_for_status()
        out.extend(res.json()["embeddings"])
    arr = np.asarray(out, dtype=np.float64).reshape(len(out), -1)
    if len(out) and arr.shape[1] != EMBED_DIM:
        sys.exit(f"embedding dim {arr.shape[1]} != contract dim {EMBED_DIM}")
    return arr


def embed_cached(texts: list[str]) -> np.ndarray:
    """Embed only texts missing from the cache. bge-m3 is deterministic, so a cached
    vector equals a fresh one and the cache can't change the trained weights."""
    cache: dict[str, np.ndarray] = {}
    if CACHE_PATH.exists():
        data = np.load(CACHE_PATH, allow_pickle=False)
        cache = dict(zip(data["texts"].tolist(), data["vecs"]))
    missing = sorted({t for t in texts if t not in cache})
    if missing:
        print(f"embedding {len(missing)} new texts via Ollama ({len(cache)} cached)")
        cache.update(zip(missing, embed(missing)))
        keys = sorted(cache)
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        np.savez(CACHE_PATH, texts=np.array(keys), vecs=np.stack([cache[k] for k in keys]))
    return np.stack([cache[t] for t in texts])


def template_folds(rows: list[dict], k: int = N_FOLDS) -> list[tuple[np.ndarray, np.ndarray]]:
    """GroupKFold keeps each template wholly on one side. It is deterministic, so the
    same templates share a fold on every run."""
    groups = [r["template_id"] for r in rows]
    k = min(k, len(set(groups)))
    return list(GroupKFold(n_splits=k).split(np.zeros(len(rows)), groups=groups))


def fit_binary(X: np.ndarray, y: np.ndarray) -> LogisticRegression | None:
    """None when y has one class: predict() then scores the flag 0 and rules cover it."""
    if len(np.unique(y)) < 2:
        return None
    clf = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=SEED)
    return clf.fit(X, y)


def oof_proba(X: np.ndarray, y: np.ndarray, folds) -> np.ndarray:
    """Out-of-fold P(flag). A fold whose train side lacks positives predicts 0: the
    flag can't be learned without that template, and the score should show it."""
    p = np.zeros(len(y))
    for tr, te in folds:
        clf = fit_binary(X[tr], y[tr])
        if clf is not None:
            p[te] = clf.predict_proba(X[te])[:, 1]
    return p


def precision_recall(y: np.ndarray, fired: np.ndarray) -> tuple[float, float]:
    tp = int((fired & (y == 1)).sum())
    n_fired, n_pos = int(fired.sum()), int((y == 1).sum())
    return (tp / n_fired if n_fired else 0.0, tp / n_pos if n_pos else 0.0)


def pick_threshold(y: np.ndarray, p: np.ndarray, min_precision: float = MIN_PRECISION) -> dict:
    """Lowest cut on CUT_GRID with precision >= min_precision (lowest = most recall).
    threshold None means no cut is safe enough: the engine should use rules only."""
    for cut in CUT_GRID:
        fired = p >= cut
        if not fired.any():
            break
        prec, rec = precision_recall(y, fired)
        if prec >= min_precision:
            return {"threshold": cut, "precision": round(prec, 3), "recall": round(rec, 3)}
    prec, rec = precision_recall(y, p >= 0.5)
    return {"threshold": None, "precision": round(prec, 3), "recall": round(rec, 3)}


def export_type(clf: LogisticRegression) -> dict:
    order = clf.classes_.tolist()
    W, b = clf.coef_, clf.intercept_
    if len(order) == 2:
        # Binary sklearn keeps one row. Softmax over [0, z] equals sigmoid(z),
        # so a zero row for class 0 gives the engine one row per class.
        W = np.vstack([np.zeros_like(W[0]), W[0]])
        b = np.array([0.0, b[0]])
    return {"classes": order, "W": W.tolist(), "b": b.tolist()}


def fit_type(X: np.ndarray, types: list[str]) -> LogisticRegression | None:
    if len(set(types)) < 2:
        return None
    clf = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=SEED)
    return clf.fit(X, types)


def type_cv_accuracy(X: np.ndarray, types: list[str], folds) -> float:
    t = np.asarray(types)
    hits = 0
    for tr, te in folds:
        clf = fit_type(X[tr], t[tr].tolist())
        if clf is not None:
            hits += int((clf.predict(X[te]) == t[te]).sum())
    return hits / len(t)


def any_fire_rate(oof: dict[str, np.ndarray], cuts: dict, mask: np.ndarray) -> float:
    """Share of masked rows where at least one flag fires at its cut. On SAFE rows this
    is the false-alarm rate (a warning on a real bank SMS); on flagged scam rows it is
    how often the classifier catches something at all."""
    fired = np.zeros(len(mask), dtype=bool)
    for flag, p in oof.items():
        cut = cuts[flag]["threshold"]
        if cut is not None:
            fired |= p >= cut
    return float(fired[mask].mean()) if mask.any() else 0.0


def fmt(cut: float | None) -> str:
    return f"{cut:.2f}" if cut is not None else " none"


def main() -> None:
    rows = load_rows()
    print(f"loaded {len(rows)} rows from {len({r['template_id'] for r in rows})} templates")
    X = embed_cached([r["text"] for r in rows])
    folds = template_folds(rows)
    print(f"{len(folds)}-fold CV grouped by template_id\n")

    flags: dict[str, dict] = {}
    cuts: dict[str, dict] = {}
    loose: dict[str, dict] = {}
    oof: dict[str, np.ndarray] = {}
    safe = np.array([r["type"] == "NONE" for r in rows])
    flagged = np.array([bool(r["flags"]) for r in rows])
    print(f"{'flag':24s} {'tpl':>3s} {'cut':>5s} {'prec':>5s} {'rec':>5s} {'safeFA':>6s}   p80: cut  rec")
    for flag in ALL_FLAGS:
        y = np.array([1 if flag in r["flags"] else 0 for r in rows])
        n_tpl = len({r["template_id"] for r in rows if flag in r["flags"]})
        clf = fit_binary(X, y)
        if clf is None:
            print(f"{flag:24s} {n_tpl:3d}  skipped (no positive rows)")
            continue
        flags[flag] = {"w": clf.coef_[0].tolist(), "b": float(clf.intercept_[0])}
        oof[flag] = oof_proba(X, y, folds)
        cuts[flag] = {**pick_threshold(y, oof[flag]), "templates": n_tpl}
        loose[flag] = {**pick_threshold(y, oof[flag], LOOSE_PRECISION), "templates": n_tpl}
        c, lc = cuts[flag], loose[flag]
        # SAFE rows this flag alone would wrongly fire on: shows where SAFE templates are thin.
        fa = int((oof[flag][safe] >= c["threshold"]).sum()) if c["threshold"] is not None else 0
        print(f"{flag:24s} {n_tpl:3d} {fmt(c['threshold']):>5s} {c['precision']:5.2f} "
              f"{c['recall']:5.2f} {fa:6d}   {fmt(lc['threshold']):>8s} {lc['recall']:4.2f}")

    types = [r["type"] for r in rows]
    type_clf = fit_type(X, types)
    print(f"\ntype CV accuracy={type_cv_accuracy(X, types, folds):.2f} over {len(set(types))} classes")
    for name, cs in (("p90", cuts), ("p80", loose)):
        print(f"{name}: SAFE false-alarm rate={any_fire_rate(oof, cs, safe):.3f}  "
              f"flagged rows caught={any_fire_rate(oof, cs, flagged):.3f}")

    weights = {
        "model": EMBED_MODEL, "dim": EMBED_DIM, "flags": flags,
        "type": export_type(type_clf) if type_clf is not None else None,
    }
    WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS_PATH.write_text(json.dumps(weights), encoding="utf-8")
    THRESHOLDS_PATH.write_text(json.dumps(cuts, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    THRESHOLDS_LOOSE_PATH.write_text(json.dumps(loose, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"\nwrote {WEIGHTS_PATH.name} ({len(flags)} flags), "
          f"{THRESHOLDS_PATH.name}, {THRESHOLDS_LOOSE_PATH.name}")


if __name__ == "__main__":
    main()
