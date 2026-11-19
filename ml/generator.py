"""Synthetic dataset generator (owner: Kiro 1).

Fills each template in templates/*.yaml with slot values from slots.yaml, then
applies surface variants so the classifier sees the same noise a real inbox has:
  - 30% stripped diacritics   (ă -> a, ș -> s, ...)
  - 20% lowercase
  - emoji sprinkled in
  - tu / dvs. register switch

Writes rows to ml/out/dataset.jsonl (git-ignored) as:
  {"text": str, "flags": [FlagCode], "type": ScamType, "template_id": str}

WHY per-template sampling, not a full cross-product: filling every template with
every slot combination explodes into millions of near-duplicate rows and leaks
templates across the train/holdout split. We draw a fixed number of seeded
samples per template instead, so the dataset is small, balanced and reproducible.

Determinism: one seeded Random instance; never unseeded randomness.
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path
from string import Formatter

import yaml

SEED = 42
SAMPLES_PER_TEMPLATE = 40
EMOJIS = ["⚠️", "📦", "🏦", "🔒", "‼️", "💳", "📞"]

HERE = Path(__file__).resolve().parent
SLOTS_PATH = HERE / "slots.yaml"
TEMPLATES_DIR = HERE / "templates"
OUT_PATH = HERE / "out" / "dataset.jsonl"

# Same map the engine uses in normalize.ts — training noise must match runtime.
_DIACRITICS = {
    "ă": "a", "â": "a", "î": "i", "ș": "s", "ş": "s", "ț": "t", "ţ": "t",
    "Ă": "A", "Â": "A", "Î": "I", "Ș": "S", "Ş": "S", "Ț": "T", "Ţ": "T",
}


def strip_diacritics(text: str) -> str:
    return "".join(_DIACRITICS.get(c, c) for c in text)


def slot_names(template: str) -> list[str]:
    """Field names referenced by a str.format template, e.g. '{bank}' -> 'bank'."""
    return [name for _, name, _, _ in Formatter().parse(template) if name]


def fill(template: str, slots: dict[str, list[str]], rng: random.Random) -> str:
    values = {name: rng.choice(slots[name]) for name in slot_names(template)}
    return template.format(**values)


def register_switch(text: str, rng: random.Random) -> str:
    """Flip formal 'dvs.' to informal 'tu' phrasing. WHY: scammers mix registers,
    and the model must not key on 'dvs.' alone as a scam signal."""
    if "dvs." not in text or rng.random() > 0.3:
        return text
    text = text.replace("dvs.", "ta")
    text = text.replace("Achitați", "Achită").replace("Plătiți", "Plătește")
    text = text.replace("Trimiteți", "Trimite").replace("Confirmați", "Confirmă")
    text = text.replace("accesați", "accesează").replace("Transferați", "Transferă")
    return text


def sprinkle_emoji(text: str, rng: random.Random) -> str:
    if rng.random() > 0.25:
        return text
    return f"{rng.choice(EMOJIS)} {text}"


def apply_variants(text: str, rng: random.Random) -> str:
    text = register_switch(text, rng)
    if rng.random() < 0.30:
        text = strip_diacritics(text)
    if rng.random() < 0.20:
        text = text.lower()
    text = sprinkle_emoji(text, rng)
    return re.sub(r"\s+", " ", text).strip()


def load_templates() -> list[dict]:
    rows: list[dict] = []
    for path in sorted(TEMPLATES_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or []
        for i, entry in enumerate(data):
            entry["template_id"] = f"{path.stem}#{i}"
            rows.append(entry)
    return rows


def generate() -> list[dict]:
    rng = random.Random(SEED)
    slots = yaml.safe_load(SLOTS_PATH.read_text(encoding="utf-8"))
    templates = load_templates()
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for tpl in templates:
        for _ in range(SAMPLES_PER_TEMPLATE):
            text = apply_variants(fill(tpl["text"], slots, rng), rng)
            key = (tpl["template_id"], text)
            if key in seen:  # drop exact dups so a tiny-slot template can't dominate
                continue
            seen.add(key)
            out.append(
                {
                    "text": text,
                    "flags": tpl.get("flags", []),
                    "type": tpl["type"],
                    "template_id": tpl["template_id"],
                }
            )
    return out


def main() -> None:
    rows = generate()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
