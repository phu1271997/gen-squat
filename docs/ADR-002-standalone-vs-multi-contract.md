# ADR-002 — Standalone Studio mode alongside multi-contract composition

## Status

Accepted · 2026-07-15 · reaffirmed with the audit fixes on 2026-07-29.

## Context

GenLayer Studio is the fastest path for a reviewer to open GenSquat,
click through a claim, and see the AI jury deliver a verdict. Studio
does not persist deployments across sessions — every reset means
redeploying every dependency the reviewer would need.

At the same time, the intended production shape is a **three-contract
protocol**: `Core` orchestrates state, `Treasury` holds staked GEN
under a stricter permission model, and `NFT` is the soulbound
credential registry. Splitting these is standard practice for
protocols where one module is a value target (Treasury) and the other
is a public-facing surface (Core).

If we required the multi-contract wiring for every Studio session, the
reviewer path would be: deploy Treasury → deploy NFT → deploy Core →
`set_dependencies(...)` → `lock_dependencies()`. Four transactions,
three addresses to copy around, before the first claim.

## Decision

`Contract` on `gen_squat_core.py` operates in **two modes at once**:

- **Standalone mode** (default): `treasury_address` and `nft_address`
  are the zero address; the core contract carries the stake ledger
  (`claim_stakes` / `dispute_stakes` TreeMaps + `withdrawable` credit
  ledger) and the SBT metadata (`boundary_nfts` TreeMap) itself.
- **Multi-contract mode**: `set_dependencies(treasury, nft)` is called
  by the deployer, then `lock_dependencies()` freezes the wiring
  permanently. From that point every stake escrow, refund, and SBT
  mint delegates to the peripheral contracts.

The `_has_treasury()` / `_has_nft()` helpers branch inside
`submit_claim` / `dispute_claim` / `mint_boundary_nft` / the resolve
paths, so contract callers do not need to know which mode is active.

## Consequences

- A reviewer deploys one contract, runs the sample dispute, sees a
  verdict + SBT — end to end in one Studio session.
- Production deploys still get the isolation of a separate Treasury; a
  bug in the AI logic cannot drain the vault without also compromising
  the frozen `treasury_address`.
- The `owner` field and `deps_locked` flag are the audit-critical
  primitives: **only** the deployer can set dependencies, and once
  locked they are permanent (see ADR nothing-here-yet-but-the-audit for
  the reviewer-flagged incident). See `tests/test_security_fixes.py`.
- The dual branch adds ~40 lines of conditional logic in the core
  contract. Alternative — always requiring peripherals — would trade
  those lines for a much worse reviewer path; not worth it.

## Alternatives rejected

- **Multi-contract only**: kills the Studio one-click demo path.
- **Standalone only**: fine for a hackathon, but not the shape you'd
  ship to mainnet. A future migration would then need a heavy state
  export / import, which we avoid by supporting both modes from day
  one.
- **Runtime-configurable mode flag**: makes upgrade paths implicit and
  hides bugs behind unused branches. Explicit `treasury_address == 0`
  is legible in every affected method.
