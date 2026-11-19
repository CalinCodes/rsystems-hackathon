"""Co-located tests for train.py. No network: embed() is swapped for seeded fake vectors,
so these check the export contract, not model quality."""

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


def test_split_holds_out_whole_templates():
    rows = [{"template_id": f"t#{i % 5}"} for i in range(50)]
    tr, te = t.split_by_template(rows)
    train_ids = {r["template_id"] for r, keep in zip(rows, tr) if keep}
    test_ids = {r["template_id"] for r, keep in zip(rows, te) if keep}
    assert train_ids.isdisjoint(test_ids)
    assert test_ids


def test_split_is_deterministic():
    rows = [{"template_id": f"t#{i}"} for i in range(20)]
    assert (t.split_by_template(rows)[0] == t.split_by_template(rows)[0]).all()


def test_export_matches_weights_contract(tmp_path, monkeypatch):
    dataset = tmp_path / "dataset.jsonl"
    dataset.write_text("\n".join(json.dumps(r) for r in _rows()), encoding="utf-8")
    monkeypatch.setattr(t, "DATASET_PATH", dataset)
    monkeypatch.setattr(t, "WEIGHTS_PATH", tmp_path / "weights.json")
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
