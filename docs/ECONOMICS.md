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

User reputation starts at a base score of `100` and is updated dynamically on-chain in the Core contract:

1. **Successful Claim Verification:** $+10$ points (capped at `200`).
2. **Failed Claim Submission (low confidence):** $-15$ points.
3. **Successful Dispute (Overturned Appeal):** $+25$ points.
4. **Frivolous Dispute (Uphold Ruling):** $-30$ points.
5. **Malicious Blacklisting:** If a user's reputation drops below `40`, they are banned from submitting new claims for `30 days` (represented by `user_ban_expiry` in the contract).
