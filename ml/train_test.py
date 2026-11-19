"""Co-located tests for train.py. No network: embed() is swapped for seeded fake vectors,
so these check the CV logic and the export contract, not model quality."""

from __future__ import annotations

import json

import numpy as np

import train as t


def _fake_embed(texts: list[str]) -> np.ndarray:
    # Seed from the text itself so the same text always maps to the same vector.
    out = []
    for text in texts:
        seed = sum(ord(c) for c in text) % (2**31)
        out.append(np.random.RandomState(seed).normal(size=t.EMBED_DIM))
    return np.asarray(out)


def _rows() -> list[dict]:
    rows = []
    for i in range(10):
        rows.append({"text": f"cod {i}", "flags": ["RF_CODE_REQUEST"], "type": "BANK_IMPERSONATION", "template_id": f"a#{i}"})
        rows.append({"text": f"salut {i}", "flags": [], "type": "NONE", "template_id": f"b#{i}"})
    return rows


def test_folds_hold_out_whole_templates():
    rows = [{"template_id": f"t#{i % 7}"} for i in range(70)]
    folds = t.template_folds(rows)
    seen_test: list[str] = []
    for tr, te in folds:
        train_ids = {rows[i]["template_id"] for i in tr}
        test_ids = {rows[i]["template_id"] for i in te}
        assert train_ids.isdisjoint(test_ids)
        seen_test += sorted(test_ids)
    assert sorted(seen_test) == sorted({r["template_id"] for r in rows})


def test_folds_are_deterministic():
    rows = [{"template_id": f"t#{i}"} for i in range(20)]
    a, b = t.template_folds(rows), t.template_folds(rows)
    assert all((x[1] == y[1]).all() for x, y in zip(a, b))


def test_pick_threshold_takes_lowest_cut_meeting_precision():
    y = np.array([1, 1, 1, 0, 0])
    p = np.array([0.95, 0.9, 0.6, 0.7, 0.1])
    # At 0.6 the 0.7 negative fires (precision 0.75); 0.71 drops it (precision 1.0).
    r = t.pick_threshold(y, p, min_precision=0.9)
    assert r["threshold"] == 0.71 and r["precision"] == 1.0
    assert r["recall"] == round(2 / 3, 3)


def test_pick_threshold_none_when_never_precise():
    y = np.array([0, 0, 1])
    p = np.array([0.99, 0.98, 0.6])
    assert t.pick_threshold(y, p)["threshold"] is None


def test_oof_is_zero_when_fold_has_no_positives():
    X = np.eye(4)
    y = np.array([1, 0, 0, 0])
    folds = [(np.array([1, 2, 3]), np.array([0]))]
    assert t.oof_proba(X, y, folds)[0] == 0.0


def test_export_matches_weights_contract(tmp_path, monkeypatch):
    dataset = tmp_path / "dataset.jsonl"
    dataset.write_text("\n".join(json.dumps(r) for r in _rows()), encoding="utf-8")
    monkeypatch.setattr(t, "DATASET_PATH", dataset)
    monkeypatch.setattr(t, "WEIGHTS_PATH", tmp_path / "weights.json")
    monkeypatch.setattr(t, "THRESHOLDS_PATH", tmp_path / "thresholds.json")
    monkeypatch.setattr(t, "THRESHOLDS_LOOSE_PATH", tmp_path / "thresholds.p80.json")
    monkeypatch.setattr(t, "CACHE_PATH", tmp_path / "emb_cache.npz")
    monkeypatch.setattr(t, "embed", _fake_embed)

    t.main()
    w = json.loads((tmp_path / "weights.json").read_text())

    assert w["model"] == "bge-m3" and w["dim"] == 1024
    m = w["flags"]["RF_CODE_REQUEST"]
    assert len(m["w"]) == 1024 and isinstance(m["b"], float)
    # Binary sklearn stores ONE row; the export must still give one row per class.
    assert w["type"]["classes"] == ["BANK_IMPERSONATION", "NONE"]
    assert len(w["type"]["W"]) == 2 and len(w["type"]["b"]) == 2
    assert all(len(row) == 1024 for row in w["type"]["W"])

    cuts = json.loads((tmp_path / "thresholds.json").read_text())
    assert set(cuts) == {"RF_CODE_REQUEST"}
    assert {"threshold", "precision", "recall", "templates"} <= set(cuts["RF_CODE_REQUEST"])
    loose = json.loads((tmp_path / "thresholds.p80.json").read_text())
    assert set(loose) == set(cuts)


def test_any_fire_rate_counts_rows_with_any_flag_over_cut():
    oof = {"A": np.array([0.9, 0.1, 0.1]), "B": np.array([0.1, 0.1, 0.8])}
    cuts = {"A": {"threshold": 0.5}, "B": {"threshold": None}}
    # B has no safe cut, so only A counts: row 0 fires, rows 1 and 2 don't.
    assert t.any_fire_rate(oof, cuts, np.array([True, True, True])) == 1 / 3


def test_cache_returns_same_vectors(tmp_path, monkeypatch):
    monkeypatch.setattr(t, "CACHE_PATH", tmp_path / "emb_cache.npz")
    calls: list[int] = []

    def counting_embed(texts):
        calls.append(len(texts))
        return _fake_embed(texts)

    monkeypatch.setattr(t, "embed", counting_embed)
    first = t.embed_cached(["a", "b"])
    second = t.embed_cached(["b", "a", "c"])
    assert calls == [2, 1]  # second call embeds only the new text
    assert np.allclose(second[0], first[1]) and np.allclose(second[1], first[0])
