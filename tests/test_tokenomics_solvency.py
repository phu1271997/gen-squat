import pytest
import json
import sys
import random
from eth_utils import to_checksum_address

def clear_known_contracts():
    for name, module in list(sys.modules.items()):
        if "genlayer" in name:
            if hasattr(module, "__known_contract__"):
                setattr(module, "__known_contract__", None)

def test_tokenomics_solvency(direct_vm, direct_deploy, direct_alice, direct_bob):
    # Patch get_store_slot to isolate contract storage
    original_get_store_slot = direct_vm._storage.get_store_slot
    def patched_get_store_slot(slot_id: bytes):
        if slot_id == b'\x00' * 32:
            addr = getattr(direct_vm, "_contract_address", None)
            if addr:
                return original_get_store_slot(addr.ljust(32, b'\x00'))
        return original_get_store_slot(slot_id)
    direct_vm._storage.get_store_slot = patched_get_store_slot

    clear_known_contracts()
    core = direct_deploy("contracts/gen_squat_core.py")
    
    clear_known_contracts()
    treasury = direct_deploy("contracts/gen_squat_treasury.py")
    
    clear_known_contracts()
    nft = direct_deploy("contracts/gen_squat_nft.py")
    
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

    # Mock satellite and LLM consensus
    direct_vm.mock_web(
        r".*overpass-api\.de/api/interpreter.*",
        {"status": 200, "body": '{"elements": []}'}
    )
    direct_vm.mock_web(
        r".*planetarycomputer\.microsoft\.com/api/stac.*",
        {"status": 200, "body": '{"features": []}'}
    )

    # Let's perform multiple claim submissions, rulings, disputes and resolves
    # We will simulate 3 different claims
    users = [direct_alice, direct_bob]
    
    # Claim 1: Alice submits claim, consensus passes with high confidence, Alice gets 100% refund
    direct_vm.sender = direct_alice
    direct_vm.warp("2023-11-15T00:00:00+00:00")
    direct_vm.value = 5_000_000_000_000_000_000 # 5 GEN
    polygon_1 = [[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]]
    claim_id_1 = core.submit_claim(json.dumps(polygon_1), 2018, 2022, "Alice land plot", "https://gen-squat.vercel.app/samples/hcmc-land-record.html")
    
    # Mock LLM consensus for high confidence
    ruling_high_conf = {
        "encroachment_detected": True,
        "area_lost_m2": 50,
        "confidence": "0.95",
        "timeline": [],
        "evidence_urls": [],
        "reasoning": "High confidence encroachment"
    }
    direct_vm.mock_llm(
        r".*AI geospatial forensics.*",
        json.dumps(ruling_high_conf)
    )
    core.analyze_claim(claim_id_1)
    
    # Wait for dispute window to expire (305 seconds warp)
    direct_vm.warp("2023-11-15T00:05:05+00:00")
    core.claim_refund(claim_id_1)
    
    # Check Alice withdrawable balance in Treasury is 5 GEN
    assert treasury.get_balance(direct_alice) == 5_000_000_000_000_000_000
    
    # Claim 2: Bob submits claim, consensus passes with low confidence, Bob gets 50% refund, remainder goes to surplus
    direct_vm.sender = direct_bob
    direct_vm.value = 5_000_000_000_000_000_000 # 5 GEN
    polygon_2 = [[21.0285, 105.8542], [21.0295, 105.8542], [21.0295, 105.8552], [21.0285, 105.8552]]
    claim_id_2 = core.submit_claim(json.dumps(polygon_2), 2018, 2022, "Bob land plot", "https://gen-squat.vercel.app/samples/hanoi-land-record.html")
    
    # Mock LLM consensus for low confidence (e.g. 0.5)
    ruling_low_conf = {
        "encroachment_detected": False,
        "area_lost_m2": 0,
        "confidence": "0.5",
        "timeline": [],
        "evidence_urls": [],
        "reasoning": "Low confidence clean"
    }
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": '{"elements": [], "features": []}'})
    direct_vm.mock_llm(r".*", json.dumps(ruling_low_conf))
    core.analyze_claim(claim_id_2)
    
    # Wait for dispute window to expire
    direct_vm.warp("2023-11-15T00:11:00+00:00")
    core.claim_refund(claim_id_2)
    
    # Bob withdrawable balance should be 2.5 GEN, and surplus pool should be 2.5 GEN
    assert treasury.get_balance(direct_bob) == 2_500_000_000_000_000_000
    stats = json.loads(treasury.get_treasury_stats())
    assert stats["surplus_pool"] == 2_500_000_000_000_000_000
    
    # Claim 3: Alice submits claim, Bob disputes, Bob wins dispute (overturned)
    # Alice submits: 5 GEN
    direct_vm.sender = direct_alice
    direct_vm.value = 5_000_000_000_000_000_000
    polygon_3 = [[12.6712, 108.0382], [12.6722, 108.0382], [12.6722, 108.0392], [12.6712, 108.0392]]
    claim_id_3 = core.submit_claim(json.dumps(polygon_3), 2018, 2022, "Alice agricultural plot", "https://gen-squat.vercel.app/samples/daklak-land-record.html")
    
    # Mock LLM consensus for claim 3 (high confidence clean)
    ruling_clean = {
        "encroachment_detected": False,
        "area_lost_m2": 0,
        "confidence": "0.9",
        "timeline": [],
        "evidence_urls": [],
        "reasoning": "Clean canopy"
    }
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": '{"elements": [], "features": []}'})
    direct_vm.mock_llm(r".*geospatial forensics consensus.*", json.dumps(ruling_clean))
    core.analyze_claim(claim_id_3)
    
    # Bob disputes (overturned verdict): Bob stakes 10 GEN
    direct_vm.sender = direct_bob
    direct_vm.value = 10_000_000_000_000_000_000 # 10 GEN
    
    # Mock LLM arbitration to return OVERTURN
    arbitration_verdict = {
        "dispute_verdict": "OVERTURN",
        "encroachment_detected": True,
        "area_lost_m2": 80,
        "confidence": "0.95",
        "reasoning": "Severe tree clearing found"
    }
    direct_vm.mock_llm(r".*arbitrator resolving a disputed.*", json.dumps(arbitration_verdict))
    core.dispute_claim(claim_id_3, "Clearing detected on western border")
    
    # Solvency checks:
    # 1. Bob's 10 GEN dispute stake should be fully refunded to Bob (total withdrawable Bob: 2.5 + 10 = 12.5 GEN)
    # 2. Bob should get 2.5 GEN (50% of Alice's locked stake) as reward (total Bob: 15.0 GEN)
    # 3. Remainder of Alice's stake (2.5 GEN) goes to surplus (surplus: 2.5 + 2.5 = 5.0 GEN)
    # 4. Total locked should decrease to 0 for these claims
    
    assert treasury.get_balance(direct_bob) == 15_000_000_000_000_000_000
    stats = json.loads(treasury.get_treasury_stats())
    assert stats["surplus_pool"] == 5_000_000_000_000_000_000
    assert stats["total_locked"] == 0
    
    # Alice withdraws her 5 GEN from Claim 1
    direct_vm.sender = direct_alice
    treasury.withdraw()
    assert treasury.get_balance(direct_alice) == 0
