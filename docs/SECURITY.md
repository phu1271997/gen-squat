# Smart Contract Security & Validation Guarantees

GenSquat v2 is architected to defend against common smart contract vulnerabilities and data poisoning attacks inside the GenLayer consensus framework.

---

## 1. Re-Entancy & Balance Solvency (Pull-Payment Pattern)
In conventional Solidity contracts, executing state changes after sending ether is a prime target for re-entrancy attacks.
- **GenSquat Prevention:** We implement a strict **Pull-Payment Pattern** in `gen_squat_treasury.py`. When claims or disputes are resolved, the treasury simply updates the user's mapping in `withdrawable_balances`.
- **Withdraw Isolation:** The actual transfer occurs only when the user explicitly triggers `withdraw()`. The withdraw method zeroes out the withdrawable balance *before* calling `emit_transfer()`, preventing re-entrant double-spend loops:
  ```python
  @gl.public.write
  def withdraw(self) -> None:
      recipient = gl.message.sender_address
      bal = self.withdrawable_balances[recipient]
      if bal <= 0:
          raise ValueError("No withdrawable balance")
      # Zero the balance first
      self.withdrawable_balances[recipient] = u256(0)
      # Transfer funds
      recipient.emit_transfer(value=bal, on='finalized')
  ```

---

## 2. Mathematical Underflow & Overflow Protections
Arithmetic operations in python contracts are safe from typical fixed-width overflows/underflows since Python handles arbitrarily large integers. However, when working with `u256` or tracking locked funds, math invariants must be maintained.
- **Treasury Solvency:** `gen_squat_treasury.py` separates `total_locked` from `surplus_pool`. When a stake is deposited, it increases `total_locked`. When resolved, it decreases `total_locked` by the exact deposit amount:
  ```python
  self.total_locked -= u256(5_000_000_000_000_000_000)
  ```
- This guarantees `total_locked` can never underflow. If any arithmetic discrepancy arises, the transaction reverts immediately, preserving existing user stakes.

---

## 3. Data Validation & Boundary Sanity Checks
To prevent users from submitting invalid boundaries (e.g. self-intersecting lines, huge regions to block validator threads, or future dates):
- **Self-Intersection Check:** `gen_squat_core.py` parses coordinate lists and runs a segment intersection algorithm (cross products) to ensure no boundary segments overlap, guaranteeing a valid simple polygon.
- **Area Threshold limits:**
  - Minimum area: $100\text{ m}^2$ (prevents tiny point claims).
  - Maximum area: $10,000,000\text{ m}^2$ (prevents gas-exhaustion attacks during validator image renderings).
- **Attic Date limits:**
  - Start year must be $\ge 2015$ (aligned with Sentinel-2 launch).
  - Current year is validated against transaction timestamp (`gl.message_raw.get("datetime")`) to prevent submissions with future year ranges.

---

## 4. Consensus Injection & Nondet Safety
GenLayer uses a democratic consensus principle where validators must agree on the outcomes of nondet calls (REST queries).
- **Determinism Enforcement:** Any non-deterministic output (like the AI reasoning JSON) is returned as a JSON-serialized string from the validator non-deterministic blocks. The contract then deserializes the string to extract numerical metrics (confidence, area lost) for state updates.
- This ensures all nodes process identical inputs, eliminating state forks.
