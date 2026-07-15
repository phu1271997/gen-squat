# Prompt for Antigravity — GenSquat finish (live bind + deploy)

Copy everything below the line into Antigravity.

---

## Task

Finish GenSquat resubmission so GenLayer judges can verify end-to-end:

> Live app must use the deployed GenLayer contract address; calls must match
> contract methods + payable values; include sample dispute with concrete
> reviewable land evidence (claim → analyze → dispute → mint).

Local repo (code already fixed for payables, land evidence samples, health panel):

`/Users/peter/Downloads/AI/Genlayer/gen-squat`

GitHub: https://github.com/phu1271997/gen-squat  
Live target: https://gen-squat.vercel.app  

## Deployed contract (authoritative — already deployed)

| Field | Value |
|---|---|
| Address | `0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386` |
| Source | `contracts/gen_squat_core.py` |
| Network | GenLayer Studionet |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | https://explorer-studio.genlayer.com/address/0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386 |

### Expected methods

`submit_claim`, `analyze_claim`, `dispute_claim`, `mint_boundary_nft`, `claim_refund`, `withdraw`, `get_claim`, `get_ruling`, `get_claim_count`, `get_boundary_nft`, `get_contract_info` (and related views)

### Payable values (must be in frontend)

| Method | Value |
|---|---|
| `submit_claim` | **5 GEN** (`5n * 10n**18n`) |
| `dispute_claim` | **10 GEN** |
| `mint_boundary_nft` | **2 GEN** |
| `analyze_claim` | 0 |

### Sample land evidence (must be public after deploy)

- https://gen-squat.vercel.app/samples/hcmc-land-record.html  
- https://gen-squat.vercel.app/samples/hanoi-land-record.html  
- https://gen-squat.vercel.app/samples/daklak-land-record.html  

## Steps (do in order)

### 1. Confirm local wiring

Working dir: `/Users/peter/Downloads/AI/Genlayer/gen-squat`

Ensure these use `0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386` and RPC `https://studio.genlayer.com/api`:

- `.env` (local; usually gitignored)
- `.env.example`
- `docs/VERIFICATION.md`
- `README.md` if it still has a placeholder

Optional schema check:

```bash
curl -s -X POST "https://studio.genlayer.com/api" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"gen_getContractSchema","params":["0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386"],"id":1}'
```

Expect `submit_claim`, `analyze_claim`, `get_claim_count`, etc.

### 2. Local build proof

```bash
cd /Users/peter/Downloads/AI/Genlayer/gen-squat
npm install
npm run build

# samples must ship
ls dist/samples/

# bundle must embed the new address + pledge methods + payable wiring
grep -R "0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386" dist && echo "OK address"
grep -R "submit_claim" dist >/dev/null && echo "OK methods"
grep -R "hcmc-land-record" dist >/dev/null && echo "OK samples refs"
```

Fix any build errors before continuing.

### 3. Commit + push public GitHub

```bash
cd /Users/peter/Downloads/AI/Genlayer/gen-squat
git status
git add -A
# keep node_modules / dist ignored if .gitignore covers them

git commit -m "$(cat <<'EOF'
fix: bind live GenSquat app to core 0x1C129d5e…

Wire VITE_CONTRACT_ADDRESS to Studionet deploy, ship sample land evidence
pages, and align payables (5/10/2 GEN) for judge E2E verification.
EOF
)"

git push origin main
```

Repo must stay **public**: https://github.com/phu1271997/gen-squat  
Do not force-push unless absolutely required and confirmed.

### 4. Vercel — env + production redeploy

Project for **https://gen-squat.vercel.app** (link to `phu1271997/gen-squat`).

| Setting | Value |
|---|---|
| Root Directory | repo root (Vite project at root, not a `frontend/` subfolder) |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Deployment Protection | **OFF** (anonymous access) |

Environment variables — **Production and Preview** (replace any empty/old value):

```text
VITE_CONTRACT_ADDRESS=0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386
VITE_GENLAYER_RPC=https://studio.genlayer.com/api
```

Critical: trigger a **new production deploy after setting env** (Vite bakes `import.meta.env` at **build** time).

CLI example:

```bash
cd /Users/peter/Downloads/AI/Genlayer/gen-squat
vercel link --yes --project gen-squat   # if needed
# set env for production + preview, then:
vercel --prod --yes
```

### 5. Hard verification (must pass)

```bash
LIVE=https://gen-squat.vercel.app
curl -sI "$LIVE" | head -12
# Expect HTTP 200. MUST NOT 302 to vercel.com/sso-api

curl -sI "$LIVE/samples/hcmc-land-record.html" | head -8
# Expect 200 — parcel HTML must be public

# Main JS asset embeds contract address
ASSET=$(curl -s "$LIVE" | grep -oE '/assets/[^"]+\.js' | head -1)
curl -s "$LIVE$ASSET" | grep -o "0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386" | head -1
curl -s "$LIVE$ASSET" | grep -o "submit_claim" | head -1
```

Incognito / logged out of Vercel:

1. Page loads without SSO.  
2. **Deployment evidence** panel shows `0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386`.  
3. Health line green: `get_claim_count()` OK (or clear error if RPC issue).  
4. Sample HCMC evidence page shows parcel table (D2-4418, polygon, fence notes).  
5. Optional smoke (if wallet has GEN on Studionet): HCMC preset → Submit Claim (5 GEN) → Analyze → Lookup.  

### 6. Docs URL polish

If production hostname differs from `https://gen-squat.vercel.app`, update `README.md`, `docs/VERIFICATION.md`, commit + push.

### 7. Return to the human

Paste back:

1. GitHub commit URL / SHA  
2. Final public live URL  
3. `curl -sI` proof (no SSO)  
4. Confirmation live UI shows `0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386` + green health  
5. Confirmation `/samples/hcmc-land-record.html` is public  
6. Confirmation Vercel env uses the new address + Studionet RPC  
7. Any blockers  

## Out of scope

- Do not redeploy a different contract unless this address is broken.  
- Do not enable Vercel password/SSO on production.  
- Do not use `http://127.0.0.1:4000/api` on Vercel.  
- Do not make the GitHub repo private.  
- Do not remove payable values from `submit_claim` / `dispute_claim` / `mint_boundary_nft`.  

## Success criteria

- [ ] Public GitHub has resubmission code + address  
- [ ] Vercel Production env = `0x1C129d5eC79829e8A6B43F9ad13F3c6aC065A386`  
- [ ] Fresh production build embeds that address  
- [ ] Sample land evidence pages public under `/samples/`  
- [ ] Live app shows deployment evidence + `get_claim_count` health  
- [ ] Judges can run: submit (5 GEN) → analyze → dispute (10 GEN) → mint (2 GEN)  

---

End of Antigravity prompt.
