"""
Regression tests for the two reviewer-flagged findings on gen_squat_core:

  A) set_dependencies was previously callable by ANY caller. It is now
     owner-only and can be permanently frozen with `lock_dependencies`.

  B) mint_boundary_nft previously minted the original ruling even after
     a dispute overturned it. It now sources the credential from the
     final dispute ruling and outright blocks the mint when the final
     verdict flipped the encroachment_detected bit.

These tests deploy only the core contract standalone (no treasury / NFT
peripherals) — the fixes are fully exercisable on core alone, and this
keeps the assertions focused on the security surface being audited.
"""

import json
import sys
import pytest


def _clear_known_contracts():
    for name, module in list(sys.modules.items()):
        if "genlayer" in name and hasattr(module, "__known_contract__"):
            setattr(module, "__known_contract__", None)


def _isolate_storage(direct_vm):
    original = direct_vm._storage.get_store_slot

    def patched(slot_id: bytes):
        if slot_id == b"\x00" * 32:
            addr = getattr(direct_vm, "_contract_address", None)
            if addr:
                return original(addr.ljust(32, b"\x00"))
        return original(slot_id)

    direct_vm._storage.get_store_slot = patched


# --------------------------------------------------------------------------
# Bug A — set_dependencies must be owner-only + lockable
# --------------------------------------------------------------------------

def test_set_dependencies_owner_only(direct_vm, direct_deploy, direct_alice, direct_bob):
    _isolate_storage(direct_vm)
    _clear_known_contracts()

    # Deployer is the default vm sender at deploy time. `direct_alice` will
    # try to overwrite dependencies after deploy and must be rejected.
    core = direct_deploy("contracts/gen_squat_core.py")
    from genlayer import Address
    deployer = direct_vm.sender

    fake_treasury = Address("0x1111111111111111111111111111111111111111")
    fake_nft = Address("0x2222222222222222222222222222222222222222")

    # Attacker (alice) tries to hijack the dependency wiring.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only the deployer/owner can update contract dependencies"):
        core.set_dependencies(fake_treasury, fake_nft)

    # A different attacker (bob) is also rejected.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the deployer/owner can update contract dependencies"):
        core.set_dependencies(fake_treasury, fake_nft)

    # Owner (deployer) may set dependencies exactly once and then freeze.
    direct_vm.sender = deployer
    good_treasury = Address("0x3333333333333333333333333333333333333333")
    good_nft = Address("0x4444444444444444444444444444444444444444")
    core.set_dependencies(good_treasury, good_nft)
    core.lock_dependencies()

    # After lock even the owner cannot change dependencies.
    with direct_vm.expect_revert("Dependencies are permanently locked"):
        core.set_dependencies(fake_treasury, fake_nft)

    # And a non-owner is (still) rejected before the lock check runs.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only the deployer/owner"):
        core.set_dependencies(fake_treasury, fake_nft)


# --------------------------------------------------------------------------
# Bug B — overturned claim must not mint the superseded original ruling
# --------------------------------------------------------------------------

def _submit_and_analyze(direct_vm, core, submitter, ruling_payload, evidence_url):
    """Submits a claim under `submitter`, then runs analyze with a mocked LLM."""
    direct_vm.sender = submitter
    direct_vm.value = 5_000_000_000_000_000_000  # 5 GEN
    polygon = [
        [10.7769, 106.7009],
        [10.7775, 106.7009],
        [10.7775, 106.7015],
        [10.7769, 106.7015],
    ]
    claim_id = core.submit_claim(
        json.dumps(polygon), 2018, 2022, "Family plot", evidence_url
    )

    # Mock external calls used by analyze_claim
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": '{"elements": [], "features": []}'})
    direct_vm.mock_llm(r".*geospatial forensics consensus.*", json.dumps(ruling_payload))
    core.analyze_claim(claim_id)
    return claim_id


def test_mint_blocked_when_dispute_flips_verdict(direct_vm, direct_deploy, direct_alice, direct_bob):
    """
    Original ruling: encroachment_detected=True, confidence=0.95.
    Dispute overturns it: encroachment_detected=False. The claim ends in
    RESOLVED_OVERTURNED and mint_boundary_nft MUST refuse — otherwise the
    SBT would carry the original (falsified) verdict.
    """
    _isolate_storage(direct_vm)
    _clear_known_contracts()

    core = direct_deploy("contracts/gen_squat_core.py")
    direct_vm.warp("2023-11-15T00:00:00+00:00")

    original = {
        "encroachment_detected": True,
        "area_lost_m2": 90,
        "confidence": "0.95",
        "timeline": [],
        "evidence_urls": [],
        "reasoning": "Original: encroachment detected",
    }
    claim_id = _submit_and_analyze(
        direct_vm, core, direct_alice, original,
        "https://gen-squat.vercel.app/samples/hcmc-land-record.html",
    )

    # Bob disputes and the arbitrator OVERTURNS (flipping the bit).
    direct_vm.sender = direct_bob
    direct_vm.value = 10_000_000_000_000_000_000  # 10 GEN
    overturned = {
        "dispute_verdict": "OVERTURN",
        "encroachment_detected": False,
        "area_lost_m2": 0,
        "confidence": "0.93",
        "reasoning": "Original ruling was wrong; no encroachment.",
    }
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": '{"elements": []}'})
    direct_vm.mock_llm(r".*arbitrator resolving a disputed.*", json.dumps(overturned))
    core.dispute_claim(claim_id, "The initial pass mislabeled shadow as fence")

    claim = json.loads(core.get_claim(claim_id))
    assert claim["status"] == "RESOLVED_OVERTURNED"

    # Mint MUST be blocked — original ruling was superseded and the final
    # verdict flipped, so the SBT would misrepresent the case.
    direct_vm.sender = direct_alice
    direct_vm.value = 2_000_000_000_000_000_000  # 2 GEN mint fee
    with direct_vm.expect_revert("the final dispute ruling overturned the original"):
        core.mint_boundary_nft(claim_id)

    # And no SBT should have been written to storage.
    with direct_vm.expect_revert("Boundary NFT does not exist"):
        core.get_boundary_nft(claim_id)


def test_mint_uses_dispute_ruling_when_overturn_agrees_on_bit(direct_vm, direct_deploy, direct_alice, direct_bob):
    """
    An 'OVERTURN' verdict that keeps the same encroachment bit but corrects
    the numbers (e.g. much smaller area lost) IS allowed to mint, but the
    credential is sourced from the FINAL dispute ruling — not the original.
    """
    _isolate_storage(direct_vm)
    _clear_known_contracts()

    core = direct_deploy("contracts/gen_squat_core.py")
    direct_vm.warp("2024-01-10T00:00:00+00:00")

    original = {
        "encroachment_detected": True,
        "area_lost_m2": 500,       # overstated
        "confidence": "0.95",
        "timeline": [],
        "evidence_urls": [],
        "reasoning": "Original: severe encroachment",
    }
    claim_id = _submit_and_analyze(
        direct_vm, core, direct_alice, original,
        "https://gen-squat.vercel.app/samples/hcmc-land-record.html",
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 10_000_000_000_000_000_000
    revised = {
        "dispute_verdict": "OVERTURN",
        "encroachment_detected": True,  # same bit
        "area_lost_m2": 60,              # corrected
        "confidence": "0.9",
        "reasoning": "Encroachment is real but the area was overstated 8x.",
    }
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "{}"})
    direct_vm.mock_llm(r".*arbitrator resolving a disputed.*", json.dumps(revised))
    core.dispute_claim(claim_id, "Area calculation is wrong; check the shoelace formula")

    direct_vm.sender = direct_alice
    direct_vm.value = 2_000_000_000_000_000_000
    core.mint_boundary_nft(claim_id)

    sbt = json.loads(core.get_boundary_nft(claim_id))
    # The SBT must carry the FINAL, corrected ruling — not the original 500m² claim.
    assert sbt["encroachment_detected"] is True
    assert sbt["source"] == "dispute_ruling"
    assert sbt["dispute_key"].startswith(f"dispute_{claim_id}_")


def test_mint_still_works_on_upheld_claim(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Happy path regression: UPHELD disputes must still mint from the original ruling."""
    _isolate_storage(direct_vm)
    _clear_known_contracts()

    core = direct_deploy("contracts/gen_squat_core.py")
    direct_vm.warp("2024-01-10T00:00:00+00:00")

    original = {
        "encroachment_detected": True,
        "area_lost_m2": 75,
        "confidence": "0.9",
        "timeline": [],
        "evidence_urls": [],
        "reasoning": "Original: encroachment detected",
    }
    claim_id = _submit_and_analyze(
        direct_vm, core, direct_alice, original,
        "https://gen-squat.vercel.app/samples/hcmc-land-record.html",
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 10_000_000_000_000_000_000
    uphold = {
        "dispute_verdict": "UPHOLD",
        "encroachment_detected": True,
        "area_lost_m2": 75,
        "confidence": "0.92",
        "reasoning": "Challenger arguments did not hold.",
    }
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "{}"})
    direct_vm.mock_llm(r".*arbitrator resolving a disputed.*", json.dumps(uphold))
    core.dispute_claim(claim_id, "I don't think encroachment happened")

    claim = json.loads(core.get_claim(claim_id))
    assert claim["status"] == "RESOLVED_UPHELD"

    direct_vm.sender = direct_alice
    direct_vm.value = 2_000_000_000_000_000_000
    core.mint_boundary_nft(claim_id)

    sbt = json.loads(core.get_boundary_nft(claim_id))
    assert sbt["source"] == "original_ruling"
