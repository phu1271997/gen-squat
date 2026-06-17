# 🚀 GenSquat — AI Land Encroachment Detection on GenLayer

**GenSquat** is a decentralized application (dApp) built on GenLayer that uses AI-powered satellite image analysis to detect land encroachment disputes. It allows claimants to submit land boundaries and timelines, then automatically crawls satellite imagery from Google Earth Engine, Sentinel Hub, and Planet Labs, and uses an LLM to perform visual change detection over time — all on-chain, without human intermediaries.

The core innovation: this is a **computer vision + spatial reasoning** task embedded inside an Intelligent Contract. No traditional blockchain (Solidity) or existing Oracle can "look at images and reason about geography." Only GenLayer's `web.render` + `exec_prompt` combo makes this possible.

---

## 📂 Directory Structure

```
/Users/ai/bot AI/GenSquat/
├── contract.py              # Main GenLayer Intelligent Contract
├── storage_test.py          # Minimal sanity-check contract for deployment
├── README.md                # Project documentation
├── test_helpers/
│   └── mock_data.py         # Mock satellite image URLs & helpers for local testing
└── .cursorrules             # Cursor AI developer rules for the GenLayer environment
```

---

## 🛠️ Detailed Contract Design

### 1. State & Data Structures

The contract manages these concepts using `TreeMap` (never standard Python `dict` or `list` for contract state):

- `claims`: Maps `claim_id` $\rightarrow$ JSON claim data containing the owner address, polygon coordinates, year range, and description.
- `claim_count`: Safely tracks the auto-increment ID counter as a `u256`.
- `claim_rulings`: Maps `claim_id` $\rightarrow$ JSON ruling result with encroachment status, area lost, confidence score, and year-by-year timeline.
- `disputes`: Maps `f"{claim_id}_{sender}"` $\rightarrow$ JSON challenge details.
- `dispute_rulings`: Maps `f"{claim_id}_{sender}"` $\rightarrow$ JSON dispute ruling.
- `boundary_nfts`: Maps `claim_id` $\rightarrow$ JSON Soulbound Token (SBT) metadata.

---

### 2. Public Methods

#### `submit_claim` (Write)
```python
def submit_claim(self, polygon_json: str, year_start: int, year_end: int, description: str) -> str
```
- Validates the coordinate formatting and year ranges.
- Increments `claim_count` and stores the claim JSON representation under the generated `claim_{id}` key.
- Automatically captures the caller's address via `gl.message.sender_address` and the block timestamp from `gl.message_raw["datetime"]`.

#### `analyze_claim` (Write / Non-Deterministic)
```python
def analyze_claim(self, claim_id: str) -> str
```
- Retrieves claim details and calculates the geographic centroid.
- Executes `gl.vm.run_nondet_unsafe` to reach consensus on the non-deterministic image analysis.
- **Leader:** Iteratively fetches satellite pages from GEE via `gl.nondet.web.render(url, mode="text")` and requests an AI evaluation via `gl.nondet.exec_prompt(...)`.
- **Validator:** Assures the response is successful and conforms strictly to the expected JSON structure.
- Saves and returns the final JSON ruling.

#### `dispute_claim` (Write / Non-Deterministic)
```python
def dispute_claim(self, claim_id: str, challenge_json: str) -> str
```
- Allows counter-parties to submit a dispute with detailed reasoning.
- Re-runs the non-deterministic spatial reasoning engine with expanded parameters (e.g., higher zoom/resolution, consideration of the dispute reasons).
- Saves and returns the arbitration decision.

#### `mint_boundary_nft` (Write)
```python
def mint_boundary_nft(self, claim_id: str) -> str
```
- Mints an immutable soulbound token containing proof of ownership or encroachment.
- Requires that a ruling exists for the claim with a confidence score $\ge 0.8$.

#### Read-only Getters (View)
- `get_claim(claim_id: str) -> str`
- `get_ruling(claim_id: str) -> str`
- `get_boundary_nft(claim_id: str) -> str`

---

## 🚀 Deploy & Verification Procedure

Follow these steps exactly in the GenLayer Studio:

### Step 1: Initialize Studio Environment
1. Open the GenLayer Studio: [studio.genlayer.com/run-debug](https://studio.genlayer.com/run-debug)
2. Go to **Settings** $\rightarrow$ Click **Reset Storage** $\rightarrow$ Confirm.
3. Perform a **hard refresh** of your browser tab (`Cmd+Shift+R` or `Ctrl+Shift+F5`).

### Step 2: Deploy & Test Storage Sanity Contract
1. Load `storage_test.py` into the editor.
2. Deploy the contract.
3. Call `set_test("Hello GenLayer")` and wait for the transaction to finalize.
4. Verify by calling `get_test()`. If it returns `"Hello GenLayer"` successfully, your environment is ready.

### Step 3: Deploy GenSquat Contract
1. Load `contract.py` into the editor.
2. Deploy the contract. Verify the transaction status in the sidebar is `Result: SUCCESS`.

### Step 4: Test a Claim and Analysis Flow
1. Call `submit_claim` with the Ho Chi Minh City coordinates:
   - **`polygon_json`**: `[[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]]`
   - **`year_start`**: `2015`
   - **`year_end`**: `2025`
   - **`description`**: `"My family's land in District 2, Ho Chi Minh City. Neighbor's fence has been moving."`
2. Wait for the transaction to finalize and copy the returned `claim_id` (e.g., `"claim_1"`).
3. Call `analyze_claim` with the `claim_id`.
   - Since this executes `run_nondet_unsafe`, it triggers the Optimistic Democracy consensus cycle (`Idleness` $\rightarrow$ `Revealing` $\rightarrow$ `Finalization`).
4. Once completed successfully, call `get_ruling("claim_1")` to view the full visual change timeline, detected encroachment area, confidence score, and reasoning explanation.
5. If the confidence is $\ge 0.8$, call `mint_boundary_nft("claim_1")` to secure your SBT proof of boundary ruling.
