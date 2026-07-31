# Tokenomics & Reputation Economy

GenSquat v2 implements an active on-chain staking economy designed to incentivize truthful boundary registration, penalize malicious land grabs, and maintain treasury solvency.

## Stake Tiers & Fee Schedules

| Action | Required Stake | Treasury Slot | Refund Policy |
| :--- | :--- | :--- | :--- |
| **Submit Claim** | `5.0 GEN` | `locked_funds[claim_id]` | Refunded $100\%$ on confidence score $\ge 0.70$. Refunded $50\%$ on confidence $< 0.70$ (low confidence penalty). |
| **Dispute Claim** | `10.0 GEN` | `locked_funds[dispute_key]` | Refunded $100\%$ if appeal is successful (Verdict Overturned). Liquidated if appeal is rejected (Verdict Upheld). |
| **Mint SBT** | `2.0 GEN` | `surplus_pool` | Non-refundable protocol fee. Goes directly to the Treasury Surplus pool. |

---

## Solvency and Liquidations Math

Treasury balance must remain solvent under all edge-case scenarios. Let $S_{claim} = 5.0\text{ GEN}$ and $S_{dispute} = 10.0\text{ GEN}$.

### Scenario A: Low-Confidence Claim Penalty
If the validator consensus returns a confidence score $C < 0.70$:
- Claimant refund is set to $50\%$ of the stake:
  $$R_{claimant} = 0.5 \times S_{claim} = 2.5\text{ GEN}$$
- The remaining $2.5\text{ GEN}$ is penalized and added directly to the treasury surplus pool:
  $$\Delta Surplus = 2.5\text{ GEN}$$
- Total Treasury withdrawable increases by $2.5\text{ GEN}$ (claims pull), and surplus pool increases by $2.5\text{ GEN}$. No underflows can occur.

### Scenario B: Challenger Overturns Ruling (Appealer Wins)
If a challenger disputes a claim and the democratic arbitration **overturns** the initial verdict:
- Challenger is rewarded with $50\%$ of the claimant's initial claim stake:
  $$Reward_{challenger} = 0.5 \times S_{claim} = 2.5\text{ GEN}$$
- The challenger gets their full dispute stake back:
  $$Refund_{challenger} = S_{dispute} = 10.0\text{ GEN}$$
- Total challenger withdrawable payout:
  $$Payout_{challenger} = Refund_{challenger} + Reward_{challenger} = 12.5\text{ GEN}$$
- The remaining $50\%$ of the claimant's stake ($2.5\text{ GEN}$) is sent to the Treasury Surplus pool:
  $$\Delta Surplus = 2.5\text{ GEN}$$
- Claimant's balance is liquidated (gets $0$ refund).

### Scenario C: Challenger Fails (Appealer Loses)
If a challenger disputes a claim and the democratic arbitration **upholds** the initial verdict:
- Challenger's dispute stake is liquidated ($0$ refund).
- The liquidated stake ($10.0\text{ GEN}$) is split:
  - $50\%$ ($5.0\text{ GEN}$) is rewarded to the claim owner as compensation for the freeze delay:
    $$Reward_{claimant} = 5.0\text{ GEN}$$
  - $50\%$ ($5.0\text{ GEN}$) is sent to the Treasury Surplus pool:
    $$\Delta Surplus = 5.0\text{ GEN}$$
- Claimant also receives their original claim stake refund:
  $$Refund_{claimant} = 5.0\text{ GEN}$$
- Total claimant withdrawable payout:
  $$Payout_{claimant} = Refund_{claimant} + Reward_{claimant} = 10.0\text{ GEN}$$

---

## Reputation Index Model

User reputation starts at `0` and moves in small integer steps around the
dispute lifecycle. Values are stored in `user_reputation:
TreeMap[Address, i256]` on the core contract and read/queried via
`get_user_stats(user)`.

| Event | Δ challenger | Δ claim owner |
|---|---|---|
| Claim upheld (dispute rejected) | −2 | +1 |
| Claim overturned (dispute succeeds) | +2 | −2 |
| Owner reputation falls below −3 | — | banned from `submit_claim` for 30 days (`user_ban_expiry`) |

Design goals:

- Small integer deltas keep griefing bounded; a single wrong dispute
  costs 2 reputation, not 30.
- The ban trigger requires *repeated* overturned rulings, so a single
  bad-faith dispute against an honest owner does not brick them.

## Tier system (Bundle B / v0.6.0)

`get_user_stats(user)` maps reputation to a tier used by the frontend
badge + the stake-discount gate on `submit_claim`:

| Tier | Reputation range | `stake_discount` | `submit_claim` cost |
|---|---|---|---|
| **Novice** | rep < 5 | ❌ | 5 GEN |
| **Verified** | 5 ≤ rep < 10 | ✅ | 4 GEN (−20%) |
| **Trusted** | 10 ≤ rep < 20 | ✅ | 4 GEN (−20%) |
| **Elder** | rep ≥ 20 | ✅ | 4 GEN (−20%) |

The stake discount is a single step at rep ≥ 5; higher tiers reserve
room for future perks (e.g. faster arbitration, larger polygon cap,
priority queue). They currently only differ in the frontend badge and
give reviewers a legible progression to observe.

Ban stays orthogonal to tier: even an Elder gets banned if their
reputation drops below −3, and the ban survives a subsequent recovery
to a higher tier until the 30-day window expires.
