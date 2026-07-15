# GenSquat — AI Land Encroachment Detection on GenLayer

GenSquat turns a land boundary claim into an on-chain AI forensics case: stake GEN, attach a **public land evidence URL**, run consensus that `web.render`s the evidence + OSM/STAC context, optionally dispute, then mint a boundary SBT.

| | |
|---|---|
| **GitHub** | https://github.com/phu1271997/gen-squat |
| **Live app** | https://gen-squat.vercel.app |
| **Core contract** | `contracts/gen_squat_core.py` |
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
| `submit_claim(polygon_json, year_start, year_end, description, land_evidence_url)` | write payable | **5 GEN** |
| `analyze_claim(claim_id)` | write | 0 |
| `dispute_claim(claim_id, challenge_reason)` | write payable | **10 GEN** |
| `mint_boundary_nft(claim_id)` | write payable | **2 GEN** |
| `get_claim` / `get_ruling` / `get_claim_count` / `get_boundary_nft` | view | — |

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

## Deploy (Studio)

1. https://studio.genlayer.com/run-debug  
2. Deploy `contracts/gen_squat_core.py` → SUCCESS  
3. Set `VITE_CONTRACT_ADDRESS` on Vercel + redeploy  
4. Deployment Protection **off**  

Handoff: [`ANTIGRAVITY_PROMPT.md`](ANTIGRAVITY_PROMPT.md)

## Docs

- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — judge path  
- [`docs/SAMPLES.md`](docs/SAMPLES.md) — scenario notes  
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)  
- [`docs/ECONOMICS.md`](docs/ECONOMICS.md)  
