# Verification pack — GenSquat (judge / reviewer)

## Reviewer feedback addressed in this resubmit

**Contract audit findings:**

1. **`set_dependencies` was callable by any account** → now owner-only,
   with a permanent `lock_dependencies` freeze. See
   [`contracts/gen_squat_core.py`](../contracts/gen_squat_core.py) fields
   `owner`, `deps_locked`, methods `set_dependencies`,
   `lock_dependencies`, `transfer_ownership`. Covered by
   [`tests/test_security_fixes.py::test_set_dependencies_owner_only`](../tests/test_security_fixes.py).

2. **Overturned claim could still mint the superseded original ruling** →
   `mint_boundary_nft` now:
   - Reverts entirely when the final dispute ruling flipped the
     `encroachment_detected` bit (SBT would misrepresent the case).
   - Sources the credential from the FINAL dispute ruling (not the
     original) whenever the claim went through arbitration.
   - Records `source: "original_ruling" | "dispute_ruling"` and
     `dispute_key` in the SBT metadata so the mint provenance is
     verifiable on-chain.

   Covered by
   [`tests/test_security_fixes.py`](../tests/test_security_fixes.py):
   - `test_mint_blocked_when_dispute_flips_verdict`
   - `test_mint_uses_dispute_ruling_when_overturn_agrees_on_bit`
   - `test_mint_still_works_on_upheld_claim`

**Live-app / evidence findings:**

3. **App wired to the deployed GenLayer contract**: the frontend calls
   `client.writeContract` / `client.readContract` against
   `VITE_CONTRACT_ADDRESS` via `genlayer-js`. A **health probe** at page
   load calls `get_claim_count` on the live contract and displays the
   result inline.

4. **One-click sample dispute** at the top of the app runs
   `submit_claim` (5 GEN, HCMC parcel + land-evidence URL) then
   `analyze_claim` on that new id — reviewer verifies the end-to-end
   flow without filling any form.

5. **Reviewable land evidence** (public HTML with parcel id, WGS84
   polygon, area, neighbor notes, year timeline) hosted on the live app
   under `/samples/`. The contract fetches this via `gl.nondet.web.render`
   inside `analyze_claim` and cross-references it against
   Overpass-Attic + Sentinel-2 STAC.

---

## Deployed contract

| Field | Value |
|---|---|
| Core source | [`contracts/gen_squat_core.py`](../contracts/gen_squat_core.py) |
| Address | `0xDc626E3c40CcEcDF3e9038dF9a8405B6ef0f919C` (v0.6.0 — prompt-injection defense, multi-perspective jury, reputation tier + SBT gallery views) |
| Network | GenLayer Studionet |
| RPC | `https://studio.genlayer.com/api` |
| Live app | https://gen-squat.vercel.app |
| GitHub | https://github.com/phu1271997/gen-squat |

> **Note for reviewer:** the audit fixes above changed the contract
> bytecode. The maintainer redeploys `gen_squat_core.py` on Studionet
> after each audit round and updates `VITE_CONTRACT_ADDRESS` on Vercel.
> The live app's "Deployment evidence" panel always shows the address
> currently bound; the health probe fails loudly if it is stale.

### Standalone Studio mode

Core works **without** treasury/NFT dependencies when those addresses
remain zero. Stakes are tracked on-core; `get_boundary_nft` stores SBT
metadata on-core. For a multi-contract layout: deploy treasury + nft,
then owner calls `set_dependencies` **once**, then `lock_dependencies`
to permanently freeze the wiring.

### Payable values (frontend and contract are aligned)

| Method | Payable |
|---|---|
| `submit_claim` | **5 GEN** (`5e18` wei) |
| `dispute_claim` | **10 GEN** |
| `mint_boundary_nft` | **2 GEN** |
| `analyze_claim` | 0 |

### Methods

`submit_claim(polygon_json, year_start, year_end, description, land_evidence_url)`
`analyze_claim(claim_id)`
`dispute_claim(claim_id, challenge_reason)` — plain-text reason
`mint_boundary_nft(claim_id)`
`set_dependencies` / `lock_dependencies` / `transfer_ownership` — owner-only
`get_claim` / `get_ruling` / `get_claim_count` / `get_boundary_nft` / `get_contract_info`

---

## Sample land evidence (public HTML the contract reads on-chain)

Hosted on the live app:

| Preset | URL |
|---|---|
| HCMC encroachment | `/samples/hcmc-land-record.html` |
| Hanoi clean | `/samples/hanoi-land-record.html` |
| Dak Lak dispute | `/samples/daklak-land-record.html` |

Each page includes parcel id, polygon WGS84 coordinates, registered
area, neighbor notes, and a year-by-year narrative. The contract calls
`gl.nondet.web.render(land_evidence_url, mode="text")` inside
`analyze_claim` and includes the page text as the primary reviewable
context in the validator LLM prompt.

---

## End-to-end judge path (≈2–5 min)

**Fast path — one click:**

1. Open [https://gen-squat.vercel.app](https://gen-squat.vercel.app).
2. Confirm the "Deployment evidence" panel shows the contract
   address + health line `Live GenLayer binding OK · get_claim_count() = N`.
3. Click the green **"Run sample dispute (submit + analyze)"** button.
4. Watch the consensus progress panel: `SUBMITTING → PROPOSING → COMMITTING → REVEALING → FINALIZED`.
5. The claim's forensic ruling appears in the right-hand column with
   confidence, area lost, and per-year timeline.

**Manual path — full control:**

1. Click **HCMC** preset (loads polygon + land-evidence URL).
2. **Submit Claim (payable 5 GEN)** → note `claim_N`.
3. **Run AI Analysis** on that id → wait for consensus.
4. **Lookup** claim + ruling (confidence, reasoning, evidence URLs).
5. Optional: **Dispute (10 GEN)** with free-text challenge — validators
   re-render Overpass-Attic and either UPHOLD or OVERTURN.
6. **Mint Boundary SBT (2 GEN)** if confidence ≥ 0.8. Under the audit
   fix, the mint is blocked when the arbitrator flipped the original
   verdict.

**Studio-only (no frontend):** deploy `gen_squat_core.py`, call the
same methods with sample polygons from
[`docs/SAMPLES.md`](SAMPLES.md) and evidence URLs pointing at the live
sample pages.

---

## Local test run

```bash
python -m pytest tests/test_security_fixes.py -v
python -m pytest tests/ -v
```

The security-fixes test module is standalone (no treasury / NFT peripheral
setup) and asserts every audit condition directly on the core contract.

---

## Reply template

```text
Thanks — resubmitted with the two audit findings fixed + live wiring proof.

Contract fixes (contracts/gen_squat_core.py):
  A) set_dependencies is now owner-only and lockable
     (see set_dependencies + lock_dependencies + transfer_ownership).
  B) mint_boundary_nft on RESOLVED_OVERTURNED claims:
        - blocks the mint when the final ruling flipped the verdict, and
        - sources the credential from the FINAL dispute ruling otherwise.
     The SBT records {source, dispute_key} for provenance.

Regression tests: tests/test_security_fixes.py
  - test_set_dependencies_owner_only
  - test_mint_blocked_when_dispute_flips_verdict
  - test_mint_uses_dispute_ruling_when_overturn_agrees_on_bit
  - test_mint_still_works_on_upheld_claim

Live-app wiring:
  - App: https://gen-squat.vercel.app  (VITE_CONTRACT_ADDRESS bound)
  - "Run sample dispute" button on the app home performs
    submit_claim + analyze_claim end-to-end in one click, against
    the HCMC parcel with a reviewable public land record:
    https://gen-squat.vercel.app/samples/hcmc-land-record.html
  - Health probe on load calls get_claim_count() and shows the address.
```
