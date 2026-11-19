"""STUB — synthetic dataset generator (owner: Kiro crew).

Fill each template in templates/*.yaml with every slot value from slots.yaml, then apply variants:
  - 30% stripped diacritics
  - 20% lowercase
  - emoji sprinkled in
  - tu / dvs. register switch
Write rows to ml/out/dataset.jsonl (git-ignored) as:
  {"text": str, "flags": [FlagCode], "type": ScamType, "template_id": str}
Determinism: random.seed(42) at the top; never use unseeded randomness.
"""

SEED = 42


def main() -> None:
    raise NotImplementedError("generator is a stub")


if __name__ == "__main__":
    main()
