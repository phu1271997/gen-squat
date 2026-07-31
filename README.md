# GenSquat — AI Land Encroachment Detection on GenLayer

GenSquat turns a land boundary claim into an on-chain AI forensics case: stake GEN, attach a **public land evidence URL**, run consensus that `web.render`s the evidence + OSM/STAC context, optionally dispute, then mint a boundary SBT.

| | |
|---|---|
| **GitHub** | https://github.com/phu1271997/gen-squat |
| **Live app** | https://gen-squat.vercel.app |
| **Core contract** | `contracts/gen_squat_core.py` · `0xDc626E3c40CcEcDF3e9038dF9a8405B6ef0f919C` (v0.6.0) |
| **Network** | GenLayer Studionet · `https://studio.genlayer.com/api` |
| **Judge pack** | [`docs/VERIFICATION.md`](docs/VERIFICATION.md) |

## Why GenLayer

Solidity cannot open a land-record page or satellite STAC feed and decide whether a fence moved. GenSquat’s heart is `web.render` + `exec_prompt` under `eq_principle.prompt_comparative`.

## Workflow + payables

```
submit_claim (+5 GEN, polygon + land_evidence_url)
    → analyze_claim (AI jury)
        → dispute_claim (+10 GEN, optional)
        → mint_boundary_nft (+2 GEN if confidence ≥ 0.8)
```

| Method | Kind | Value |
|---|---|---|
| `submit_claim(polygon_json, year_start, year_end, description, land_evidence_url)` | write payable | **5 GEN** (4 GEN for rep ≥ 5) |
| `analyze_claim(claim_id)` | write | 0 |
| `dispute_claim(claim_id, challenge_reason)` | write payable | **10 GEN** |
| `mint_boundary_nft(claim_id)` | write payable | **2 GEN** |
| `get_claim` / `get_ruling` / `get_claim_count` / `get_boundary_nft` | view | — |
| `get_user_stats(user)` / `get_user_sbts(user)` | view | — |

Standalone Studio mode: leave treasury/nft addresses at zero. Optional multi-contract in `contracts/gen_squat_treasury.py` + `gen_squat_nft.py` via `set_dependencies`.

## Sample land evidence (reviewable)

| Preset | Path |
|---|---|
| HCMC encroachment | `/samples/hcmc-land-record.html` |
| Hanoi clean | `/samples/hanoi-land-record.html` |
| Dak Lak farm dispute | `/samples/daklak-land-record.html` |

Each page has parcel id, polygon, area, neighbor notes, and year timeline for `web.render`.

## Local run

```bash
cp .env.example .env
# set VITE_CONTRACT_ADDRESS after Studio deploy
npm install
npm run dev
```

## Wallet

MetaMask signs every write. No burner key is generated in the browser or
shipped in the bundle. On connect the dApp calls
`wallet_switchEthereumChain` (chain `0xF1EF` = 61999) and falls back to
`wallet_addEthereumChain` if Studionet is not yet in MetaMask. Fund the
connected account with GEN from **Studio → Accounts** before the first
write — Studionet has no public faucet. Read-only views work without a
wallet.

## Deploy (Studio)

1. https://studio.genlayer.com/run-debug
2. Deploy `contracts/gen_squat_core.py` → SUCCESS
3. Set `VITE_CONTRACT_ADDRESS` on Vercel + redeploy
4. Deployment Protection **off**

Handoff: [`ANTIGRAVITY_PROMPT.md`](ANTIGRAVITY_PROMPT.md)

## What's new · v0.6.0

- **AI Enhancement + Security Hardening** — prompt-injection defense
  (input sanitizer + XML-boundary tagging + output canary + validator
  agreement on `injection_detected`), multi-perspective consensus
  (Forensic / Legal / Skeptic), mint guard against injection-flagged
  rulings. See [`docs/ADR-004-prompt-injection-defense.md`](docs/ADR-004-prompt-injection-defense.md).
- **Reputation Tier + SBT Gallery** — `get_user_stats` /
  `get_user_sbts` views, header tier badge (Novice / Verified /
  Trusted / Elder), collapsible profile panel with live SBT gallery.
- 33 pytest tests, all green (`gltest tests/`).

Full history in [`CHANGELOG.md`](CHANGELOG.md).

## Docs

- [`CHANGELOG.md`](CHANGELOG.md) — semver history
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — dev + review conventions
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — judge path
- [`docs/SAMPLES.md`](docs/SAMPLES.md) — scenario notes
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — module + sequence diagrams
- [`docs/ECONOMICS.md`](docs/ECONOMICS.md) — stakes + reputation tiers
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model + mitigations
- [`docs/ADR-001-optimistic-democracy.md`](docs/ADR-001-optimistic-democracy.md) — consensus API choice
- [`docs/ADR-002-standalone-vs-multi-contract.md`](docs/ADR-002-standalone-vs-multi-contract.md) — dual-mode design
- [`docs/ADR-003-metamask-only-signing.md`](docs/ADR-003-metamask-only-signing.md) — signing model
- [`docs/ADR-004-prompt-injection-defense.md`](docs/ADR-004-prompt-injection-defense.md) — layered defense
- [`docs/02-common-errors.md`](docs/02-common-errors.md) — repo-local pitfalls reference
