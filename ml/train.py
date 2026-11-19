"""STUB — classifier training (owner: Kiro crew).

Steps:
  1. Read ml/out/dataset.jsonl.
  2. Embed texts via Ollama POST http://localhost:11434/api/embed (model "bge-m3", batched).
  3. Hold out 15% BY template_id (never random rows — avoids template leakage).
  4. Train one LogisticRegression(class_weight='balanced') per flag + one multinomial model for type.
  5. Print per-flag precision/recall on the held-out set.
  6. Export ml/out/weights.json matching contracts/types.ts `Weights`:
     {"model": "bge-m3", "dim": 1024,
      "flags": {FlagCode: {"w": [...], "b": float}},
      "type": {"classes": [...], "W": [[...]], "b": [...]} }
Use random_state=42 everywhere.
"""

SEED = 42
OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"


def main() -> None:
    raise NotImplementedError("train is a stub")


if __name__ == "__main__":
    main()
