import pytest
import json
import sys
from eth_utils import to_checksum_address

def clear_known_contracts():
    for name, module in list(sys.modules.items()):
        if "genlayer" in name:
            if hasattr(module, "__known_contract__"):
                setattr(module, "__known_contract__", None)

def test_submit_claim_validation(direct_vm, direct_deploy, direct_alice, direct_bob):
    # Patch get_store_slot to isolate contract storage
    original_get_store_slot = direct_vm._storage.get_store_slot
    def patched_get_store_slot(slot_id: bytes):
        if slot_id == b'\x00' * 32:
            addr = getattr(direct_vm, "_contract_address", None)
            if addr:
                return original_get_store_slot(addr.ljust(32, b'\x00'))
        return original_get_store_slot(slot_id)
    direct_vm._storage.get_store_slot = patched_get_store_slot

    # Clear registry so we can deploy multiple contracts in this session
    clear_known_contracts()
    core = direct_deploy("contracts/gen_squat_core.py")
    
    clear_known_contracts()
    treasury = direct_deploy("contracts/gen_squat_treasury.py")
    
    clear_known_contracts()
    nft = direct_deploy("contracts/gen_squat_nft.py")
    
    # Wire dependencies
    treasury.set_core_address(core.address)
    nft.set_core_address(core.address)
    core.set_dependencies(treasury.address, nft.address)

    # Setup mock interfaces for cross-contract calls
    def setup_mock_interfaces(vm, core_inst, treasury_inst, nft_inst):
        core_module = sys.modules["_contract_gen_squat_core"]
        
        class MockTreasuryInterface:
            def __init__(self, address):
                self.address = address
            def emit(self, value=0, on='finalized'):
                self.value = value
                return self
            def deposit_claim_stake(self, user, claim_id):
                orig_sender, orig_val = vm.sender, vm.value
                try:
                    vm.sender = core_inst.address
                    vm.value = self.value
                    treasury_inst.deposit_claim_stake(user, claim_id)
                finally:
                    vm.sender, vm.value = orig_sender, orig_val
            def deposit_dispute_stake(self, user, dispute_key):
                orig_sender, orig_val = vm.sender, vm.value
                try:
                    vm.sender = core_inst.address
                    vm.value = self.value
                    treasury_inst.deposit_dispute_stake(user, dispute_key)
                finally:
                    vm.sender, vm.value = orig_sender, orig_val
            def deposit_mint_fee(self):
                orig_sender, orig_val = vm.sender, vm.value
                try:
                    vm.sender = core_inst.address
                    vm.value = self.value
                    treasury_inst.deposit_mint_fee()
                finally:
                    vm.sender, vm.value = orig_sender, orig_val
            def resolve_claim(self, claim_id, owner, refund_amount):
                orig_sender, orig_val = vm.sender, vm.value
                try:
                    vm.sender = core_inst.address
                    vm.value = self.value
                    treasury_inst.resolve_claim(claim_id, owner, refund_amount)
                finally:
                    vm.sender, vm.value = orig_sender, orig_val
            def resolve_dispute(self, claim_id, dispute_key, challenger, claim_owner, is_overturned, original_refund):
                orig_sender, orig_val = vm.sender, vm.value
                try:
                    vm.sender = core_inst.address
                    vm.value = self.value
                    treasury_inst.resolve_dispute(claim_id, dispute_key, challenger, claim_owner, is_overturned, original_refund)
                finally:
                    vm.sender, vm.value = orig_sender, orig_val

        class MockNFTInterface:
            def __init__(self, address):
                self.address = address
            def emit(self, value=0, on='finalized'):
                self.value = value
                return self
            def mint_sbt(self, owner, claim_id, polygon_json, evidence_urls_json, ruling_hash):
                orig_sender, orig_val = vm.sender, vm.value
                try:
                    vm.sender = core_inst.address
                    vm.value = self.value
                    nft_inst.mint_sbt(owner, claim_id, polygon_json, evidence_urls_json, ruling_hash)
                finally:
                    vm.sender, vm.value = orig_sender, orig_val

        core_module.TreasuryInterface = MockTreasuryInterface
        core_module.NFTInterface = MockNFTInterface

    setup_mock_interfaces(direct_vm, core, treasury, nft)
    
    # Setup user context (Alice as submitter)
    direct_vm.sender = direct_alice
    
    # Valid HCMC boundary coordinates (approx 600m2)
    valid_polygon = [[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]]
    valid_polygon_json = json.dumps(valid_polygon)
    
    # Set block metadata (time and year)
    direct_vm.warp("2023-11-15T00:00:00+00:00")
    
    # Check that submitting without enough value fails
    with direct_vm.expect_revert("Insufficient stake provided"):
        direct_vm.value = 1_000_000_000_000_000_000 # 1 GEN (insufficient)
        core.submit_claim(valid_polygon_json, 2018, 2022, "My residential plot")
        
    # Check successful submission with 5 GEN
    direct_vm.value = 5_000_000_000_000_000_000 # 5 GEN
    claim_id = core.submit_claim(valid_polygon_json, 2018, 2022, "My residential plot")
    assert claim_id == "claim_1"
    
    # Verify claim storage state
    claim_json = core.get_claim("claim_1")
    claim = json.loads(claim_json)
    assert claim["owner"] == to_checksum_address(direct_alice)
    assert claim["year_start"] == 2018
    assert claim["year_end"] == 2022
    assert claim["description"] == "My residential plot"
    assert claim["status"] == "SUBMITTED"
    assert claim["area_m2"] > 0
    
    # Verify Treasury locked the funds
    locked = treasury.get_locked_funds("claim_1")
    assert locked == 5_000_000_000_000_000_000
    
    # Check self-intersection validator
    intersecting_polygon = [[10.0, 10.0], [11.0, 11.0], [10.0, 11.0], [11.0, 10.0]]
    with direct_vm.expect_revert("Polygon boundaries must not self-intersect"):
        direct_vm.value = 5_000_000_000_000_000_000
        core.submit_claim(json.dumps(intersecting_polygon), 2018, 2022, "Self-intersecting")
        
    # Check area maximum limits validator
    huge_polygon = [[10.0, 10.0], [11.0, 10.0], [11.0, 11.0], [10.0, 11.0]] # ~12,000 km2
    with direct_vm.expect_revert("Polygon area"):
        direct_vm.value = 5_000_000_000_000_000_000
        core.submit_claim(json.dumps(huge_polygon), 2018, 2022, "Too huge")
        
    # Check area minimum limits validator
    tiny_polygon = [[10.7769, 106.7009], [10.776901, 106.7009], [10.776901, 106.700901], [10.7769, 106.700901]] # tiny
    with direct_vm.expect_revert("Polygon area"):
        direct_vm.value = 5_000_000_000_000_000_000
        core.submit_claim(json.dumps(tiny_polygon), 2018, 2022, "Too tiny")
        
    # Check date validator
    with direct_vm.expect_revert("Start year cannot be before 2015"):
        direct_vm.value = 5_000_000_000_000_000_000
        core.submit_claim(valid_polygon_json, 2012, 2018, "Before 2015")
        
    with direct_vm.expect_revert("Start year must be strictly less than end year"):
        direct_vm.value = 5_000_000_000_000_000_000
        core.submit_claim(valid_polygon_json, 2020, 2020, "Equal years")
