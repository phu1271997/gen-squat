# ADR-001 — Use `eq_principle.prompt_comparative` for the AI jury

## Status

Accepted · 2026-07-15 · load-bearing for both `analyze_claim` and
`dispute_claim`.

## Context

GenSquat's ruling is a *subjective* judgment: given a polygon, a
description, and web-fetched satellite / OSM / cadastral context, has an
encroachment occurred? Two things follow from this:

1. Validators must **agree on the verdict**, not on the exact prose of
   the `reasoning` field. A bit-exact comparison (`strict_eq`) on the
   full JSON would fail consensus every time the LLMs paraphrased each
   other.
2. Validators must run the same web fetches + LLM prompt as the leader
   to have grounds to disagree. If they merely score the leader's
   output they cannot detect a hallucinated web response.

The GenLayer SDK offers three tools that fit this shape (see
`docs/02-common-errors.md § Rule #7`):

| API | What validators do | Fits GenSquat? |
|---|---|---|
| `gl.eq_principle.strict_eq` | Bit-exact match | ❌ verdict is JSON with free-form `reasoning` |
| `gl.eq_principle.prompt_comparative(fn, principle)` | Re-run `fn`, then LLM-compare against a rule | ✅ |
| `gl.eq_principle.prompt_non_comparative(fn, task, criteria)` | Score the leader's output only | ❌ can't catch a fabricated web fetch |
| `gl.vm.run_nondet(leader_fn, validator_fn)` | Fully custom validator | ✅ but reinvents the wheel |

## Decision

Both `analyze_claim` and `dispute_claim` execute their consensus block
through `gl.eq_principle.prompt_comparative(task_fn, principle)`.

The **principle** encodes verdict semantics — the fields validators are
required to agree on and the tolerances allowed. It is version-locked
with the contract; changing it is a schema change and must ship in a
new deploy.

Current principle for `analyze_claim`:

> Validators MUST agree on:
> (1) `encroachment_detected` boolean (exact match required).
> (2) `area_lost_m2` within 15% relative deviation.
> (3) `confidence` within 0.15 absolute deviation.
> (4) `injection_detected` boolean (exact match required).
> (5) `timeline` years must be monotonically ascending in both rulings.
> (6) if `confidence > 0.9`, `evidence_urls` length must be ≥ 2 in both
>     rulings.
> If any of the above diverges, consensus MUST fail.

## Consequences

- Validators re-execute all `gl.nondet.web.render(...)` and
  `gl.nondet.exec_prompt(...)` calls. This is more expensive than a
  scoring pass, but it is the only way to catch a leader that fabricated
  a web response.
- Adding new fields to the ruling JSON does not itself break consensus;
  adding new fields to the principle does. We keep the principle
  narrowly focused on verdict semantics.
- `prompt_comparative` is a wrapper on `gl.vm.run_nondet`, so future
  migration to a fully custom `validator_fn` (e.g. to add
  multi-signature attestations) is a mechanical rewrite.

## Alternatives rejected

- **`strict_eq` on a canonical JSON subset**: brittle. Every LLM
  variation of the `reasoning` field would fail consensus, even when
  the verdict itself matched.
- **`prompt_non_comparative`**: cheaper per-tx, but validators would
  score the leader's *self-reported* web/LLM output. A malicious leader
  could invent evidence and no validator would notice.
- **Custom `run_nondet(leader_fn, validator_fn)`**: would work; we
  choose the wrapper for readability and to keep the principle string
  as the single source of truth for what "agree" means.
