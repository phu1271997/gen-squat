# Verification pack — GenSquat (judge / reviewer)

## Feedback addressed

1. Configure the **deployed GenLayer contract address** in the live app.  
2. Align app calls with **current contract methods + payable values**.  
3. Provide a **sample dispute with concrete reviewable land evidence** so  
   claim → analyze → dispute → mint can be tested end to end.

---

## Deployed contract (fill after Studio deploy)

| Field | Value |
|---|---|
| Core source | `contracts/gen_squat_core.py` |
| Address | `0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386` |
| Network | GenLayer Studionet |
| RPC | `https://studio.genlayer.com/api` |
| Live app | https://gen-squat.vercel.app |
| GitHub | https://github.com/phu1271997/gen-squat |

### Standalone Studio mode

Core works **without** treasury/NFT dependencies when those addresses remain zero.
Stakes are tracked on-core; `get_boundary_nft` stores SBT metadata on-core.
Optional multi-contract: deploy treasury + nft, then `set_dependencies`.

### Payable values (must match frontend)

| Method | Payable |
|---|---|
| `submit_claim` | **5 GEN** (`5e18` wei) |
| `dispute_claim` | **10 GEN** |
| `mint_boundary_nft` | **2 GEN** |
| `analyze_claim` | 0 |

### Methods

`submit_claim(polygon_json, year_start, year_end, description, land_evidence_url)`  
`analyze_claim(claim_id)`  
`dispute_claim(claim_id, challenge_reason)` — plain text reason  
`mint_boundary_nft(claim_id)`  
`get_claim` / `get_ruling` / `get_claim_count` / `get_boundary_nft` / `get_contract_info`

---

## Sample land evidence (public HTML)

Hosted on the live app after deploy:

| Preset | URL |
|---|---|
| HCMC encroachment | `/samples/hcmc-land-record.html` |
| Hanoi clean | `/samples/hanoi-land-record.html` |
| Dak Lak dispute | `/samples/daklak-land-record.html` |

Each page includes parcel id, polygon WGS84, area, neighbor notes, and a
year-by-year narrative the contract can `web.render`.

---

## End-to-end judge path (≈5–10 min)

1. Open live app → confirm **Deployment evidence** shows contract address.  
2. Health line: `get_claim_count()` OK.  
3. Click **HCMC** preset (loads polygon + land evidence URL).  
4. **Submit Claim (payable 5 GEN)** → note `claim_N`.  
5. **Run AI Analysis** on that id → wait for consensus.  
6. **Lookup** claim + ruling (confidence, reasoning, evidence URLs).  
7. Optional: **Dispute (10 GEN)** with free-text challenge.  
8. **Mint Boundary SBT (2 GEN)** if confidence ≥ 0.8.  

Studio-only (no frontend): deploy `gen_squat_core.py`, call the same methods
with sample polygon from `docs/SAMPLES.md` and evidence URL pointing at the
live sample page.

---

## Reply template

```text
Thanks — resubmitted with live GenLayer binding + sample land evidence.

1) Live app: https://gen-squat.vercel.app (public)
2) Contract: 0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386 on Studionet
   (contracts/gen_squat_core.py)
3) Payables aligned: submit 5 GEN, dispute 10 GEN, mint 2 GEN
4) Methods: submit_claim(+land_evidence_url), analyze_claim, dispute_claim, mint_boundary_nft
5) Sample evidence (reviewable HTML):
   https://gen-squat.vercel.app/samples/hcmc-land-record.html
   (+ hanoi / daklak samples)
6) E2E: HCMC preset → submit → analyze → (optional dispute) → mint
```
