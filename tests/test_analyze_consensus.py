import pytest
import json
import sys

def clear_known_contracts():
    for name, module in list(sys.modules.items()):
        if "genlayer" in name:
            if hasattr(module, "__known_contract__"):
                setattr(module, "__known_contract__", None)

def test_analyze_consensus_flow(direct_vm, direct_deploy, direct_alice):
    # Patch get_store_slot to isolate contract storage
    original_get_store_slot = direct_vm._storage.get_store_slot
    def patched_get_store_slot(slot_id: bytes):
        if slot_id == b'\x00' * 32:
            addr = getattr(direct_vm, "_contract_address", None)
            if addr:
                return original_get_store_slot(addr.ljust(32, b'\x00'))
        return original_get_store_slot(slot_id)
    direct_vm._storage.get_store_slot = patched_get_store_slot

    # 1. Deploy & Wire contracts
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
    
    # 2. Submit a claim
    direct_vm.sender = direct_alice
    valid_polygon = [[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]]
    valid_polygon_json = json.dumps(valid_polygon)
    
    direct_vm.warp("2023-11-15T00:00:00+00:00")
    direct_vm.value = 5_000_000_000_000_000_000 # 5 GEN
    claim_id = core.submit_claim(valid_polygon_json, 2018, 2022, "District 2 plot")
    assert claim_id == "claim_1"
    
    # 3. Setup mocks for Web APIs and LLM
    # Overpass API mock
    direct_vm.mock_web(
        r".*overpass-api\.de/api/interpreter.*",
        {"status": 200, "body": '{"elements": [{"type": "way", "id": 12345, "tags": {"building": "yes"}}]}'}
    )
    
    # Planetary Computer STAC mock
    direct_vm.mock_web(
        r".*planetarycomputer\.microsoft\.com/api/stac.*",
        {"status": 200, "body": '{"features": [{"id": "S2_2020", "assets": {"thumbnail": {"href": "https://api.pc.com/thumb.png"}}}]}'}
    )
    
    # LLM Analysis mock
    mocked_ruling = {
        "encroachment_detected": True,
        "area_lost_m2": 120,
        "confidence": "0.9",
        "timeline": [
            {"year": 2018, "status": "clean", "detail": "Canopy intact, no buildings"},
            {"year": 2022, "status": "severe", "detail": "Encroachment structure detected on western border"}
        ],
        "evidence_urls": ["https://planetarycomputer.microsoft.com/api/stac/v1/assets/S2_2022_thumb.png"],
        "reasoning": "The neighbor built a fence and garage shifted 2.3 meters inside claimant boundary."
    }
    direct_vm.mock_llm(
        r".*AI geospatial forensics.*",
        json.dumps(mocked_ruling)
    )
    
    # 4. Trigger AI analysis
    ruling_json = core.analyze_claim("claim_1")
    ruling = json.loads(ruling_json)
    
    assert ruling["encroachment_detected"] is True
    assert ruling["area_lost_m2"] == 120
    assert float(ruling["confidence"]) == 0.9
    assert len(ruling["timeline"]) == 2
    assert ruling["timeline"][0]["status"] == "clean"
    
    # 5. Check updated claim status
    claim = json.loads(core.get_claim("claim_1"))
    assert claim["status"] == "ANALYZED"
    assert claim["analyzed_at"] > 0
