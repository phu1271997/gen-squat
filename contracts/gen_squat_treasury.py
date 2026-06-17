# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class Contract(gl.Contract):
    # Owner of the treasury (deployer)
    owner: Address
    # Core contract address
    core_address: Address
    # Mapping of item_id/key -> locked amount (wei)
    locked_funds: TreeMap[str, u256]
    # Mapping of user address -> withdrawable balance (wei)
    withdrawable_balances: TreeMap[Address, u256]
    # Treasury surplus pool (accumulated fees/forfeits)
    surplus_pool: u256
    # Total active locked stake
    total_locked: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.core_address = Address("0x0000000000000000000000000000000000000000")
        self.surplus_pool = u256(0)
        self.total_locked = u256(0)

    @gl.public.write
    def set_core_address(self, core_address: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise ValueError("Only owner can set core address")
        self.core_address = core_address

    # Helper to assert only core can call
    def _only_core(self):
        if gl.message.sender_address != self.core_address:
            raise ValueError("Only the core contract can invoke this function")

    @gl.public.write.payable
    def deposit_claim_stake(self, user: Address, claim_id: str) -> None:
        self._only_core()
        val = gl.message.value
        # 5 GEN = 5 * 10^18 wei
        if val < u256(5_000_000_000_000_000_000):
            raise ValueError("Insufficient claim stake deposited")
        self.locked_funds[claim_id] = val
        self.total_locked = self.total_locked + val

    @gl.public.write.payable
    def deposit_dispute_stake(self, user: Address, dispute_key: str) -> None:
        self._only_core()
        val = gl.message.value
        # 10 GEN = 10 * 10^18 wei
        if val < u256(10_000_000_000_000_000_000):
            raise ValueError("Insufficient dispute stake deposited")
        self.locked_funds[dispute_key] = val
        self.total_locked = self.total_locked + val

    @gl.public.write.payable
    def deposit_mint_fee(self) -> None:
        self._only_core()
        val = gl.message.value
        # 2 GEN mint fee goes directly to surplus pool
        self.surplus_pool = self.surplus_pool + val

    @gl.public.write
    def resolve_claim(self, claim_id: str, owner: Address, refund_amount: u256) -> None:
        self._only_core()
        locked = u256(0)
        if claim_id in self.locked_funds:
            locked = self.locked_funds[claim_id]
            
        if locked == u256(0):
            return  # already resolved or not found
            
        if refund_amount > locked:
            refund_amount = locked
            
        surplus = locked - refund_amount
        
        # Credit refund to owner's withdrawable balance
        if refund_amount > u256(0):
            current_bal = u256(0)
            if owner in self.withdrawable_balances:
                current_bal = self.withdrawable_balances[owner]
            self.withdrawable_balances[owner] = current_bal + refund_amount
            
        # Credit surplus to pool
        if surplus > u256(0):
            self.surplus_pool = self.surplus_pool + surplus
            
        # Clean up
        self.locked_funds[claim_id] = u256(0)
        self.total_locked = self.total_locked - locked

    @gl.public.write
    def resolve_dispute(self, claim_id: str, dispute_key: str, challenger: Address, claim_owner: Address, is_overturned: bool, original_refund: u256) -> None:
        self._only_core()
        locked_dispute = u256(0)
        if dispute_key in self.locked_funds:
            locked_dispute = self.locked_funds[dispute_key]
            
        if locked_dispute == u256(0):
            return  # already resolved or not found

        locked_claim = u256(0)
        if claim_id in self.locked_funds:
            locked_claim = self.locked_funds[claim_id]

        if is_overturned:
            # Challenger wins:
            # 1. Refund challenger's 10 GEN
            current_challenger_bal = u256(0)
            if challenger in self.withdrawable_balances:
                current_challenger_bal = self.withdrawable_balances[challenger]
            self.withdrawable_balances[challenger] = current_challenger_bal + locked_dispute
            
            # 2. Challenger gets 50% of claim's stake as reward
            reward = u256(2_500_000_000_000_000_000) # 2.5 GEN
            if locked_claim >= reward:
                self.withdrawable_balances[challenger] = self.withdrawable_balances[challenger] + reward
                # Rest of claim stake goes to surplus
                remainder = locked_claim - reward
                self.surplus_pool = self.surplus_pool + remainder
                self.total_locked = self.total_locked - locked_claim
                self.locked_funds[claim_id] = u256(0)
            else:
                # Fallback to surplus pool if claim stake already released/not found
                if self.surplus_pool >= reward:
                    self.surplus_pool = self.surplus_pool - reward
                    self.withdrawable_balances[challenger] = self.withdrawable_balances[challenger] + reward
                if locked_claim > u256(0):
                    self.surplus_pool = self.surplus_pool + locked_claim
                    self.total_locked = self.total_locked - locked_claim
                    self.locked_funds[claim_id] = u256(0)
        else:
            # Challenger loses:
            # 1. Dispute stake goes entirely to surplus
            self.surplus_pool = self.surplus_pool + locked_dispute
            
            # 2. Claim owner gets their refund
            if locked_claim > u256(0):
                if original_refund > locked_claim:
                    original_refund = locked_claim
                current_owner_bal = u256(0)
                if claim_owner in self.withdrawable_balances:
                    current_owner_bal = self.withdrawable_balances[claim_owner]
                self.withdrawable_balances[claim_owner] = current_owner_bal + original_refund
                
                surplus = locked_claim - original_refund
                if surplus > u256(0):
                    self.surplus_pool = self.surplus_pool + surplus
                self.locked_funds[claim_id] = u256(0)
                self.total_locked = self.total_locked - locked_claim

        self.locked_funds[dispute_key] = u256(0)
        self.total_locked = self.total_locked - locked_dispute

    @gl.public.write
    def withdraw(self) -> None:
        user = gl.message.sender_address
        bal = u256(0)
        if user in self.withdrawable_balances:
            bal = self.withdrawable_balances[user]
            
        if bal == u256(0):
            raise ValueError("No balance to withdraw")
            
        self.withdrawable_balances[user] = u256(0)
        
        # Asynchronously send the balance to the user's wallet
        recipient = gl.get_contract_at(user)
        recipient.emit_transfer(value=bal, on='finalized')

    @gl.public.view
    def get_locked_funds(self, key: str) -> u256:
        if key not in self.locked_funds:
            return u256(0)
        return self.locked_funds[key]

    @gl.public.view
    def get_balance(self, user: Address) -> u256:
        from genlayer.py.types import Address
        if not isinstance(user, Address):
            user = Address(user)
        if user not in self.withdrawable_balances:
            return u256(0)
        return self.withdrawable_balances[user]

    @gl.public.view
    def get_treasury_stats(self) -> str:
        stats = {
            "surplus_pool": int(self.surplus_pool),
            "total_locked": int(self.total_locked)
        }
        import json
        return json.dumps(stats)
