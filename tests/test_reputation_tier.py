"""
Bundle B regression tests: reputation tier + user stats + SBT gallery view.

Coverage:
  T1. New account: tier=Novice, no discount, zero counts.
  T2. Reputation >= 5 flips to Verified + stake_discount=true.
  T3. Reputation >= 10 → Trusted; >= 20 → Elder.
  T4. get_user_stats counts claims owned + SBTs minted by that address.
  T5. get_user_sbts returns only SBTs owned by the queried address.
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


GOOD_POLYGON = json.dumps([
    [10.7769, 106.7009],
    [10.7775, 106.7009],
    [10.7775, 106.7015],
    [10.7769, 106.7015],
])
GOOD_URL = "https://gen-squat.vercel.app/samples/hcmc-land-record.html"


def _submit_and_analyze(direct_vm, core, submitter, description="Family plot", url=GOOD_URL):
    direct_vm.sender = submitter
    direct_vm.value = 5_000_000_000_000_000_000
    claim_id = core.submit_claim(GOOD_POLYGON, 2018, 2022, description, url)

    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": '{"elements": []}'})
    direct_vm.mock_llm(r".*geospatial forensics consensus.*", json.dumps({
        "encroachment_detected": True,
        "area_lost_m2": 60,
        "confidence": "0.9",
        "timeline": [],
        "evidence_urls": [url, "https://example.org/osm"],
        "perspectives": {"forensic": "f", "legal": "l", "skeptic": "s"},
        "injection_detected": False,
        "reasoning": "clean",
    }))
    core.analyze_claim(claim_id)
    return claim_id


def _mint(direct_vm, core, minter, claim_id):
    direct_vm.sender = minter
    direct_vm.value = 2_000_000_000_000_000_000
    core.mint_boundary_nft(claim_id)


# --------------------------------------------------------------------------
# T1: default profile
# --------------------------------------------------------------------------

def test_user_stats_defaults_to_novice(direct_vm, direct_deploy, direct_alice):
    _isolate_storage(direct_vm)
    _clear_known_contracts()

    core = direct_deploy("contracts/gen_squat_core.py")
    direct_vm.warp("2024-05-01T00:00:00+00:00")

    from genlayer import Address
    stats = json.loads(core.get_user_stats(Address(direct_alice)))
    assert stats["reputation"] == 0
    assert stats["tier"] == "Novice"
    assert stats["stake_discount"] is False
    assert stats["claim_count"] == 0
    assert stats["sbt_count"] == 0
    assert stats["ban_expiry"] == 0


# --------------------------------------------------------------------------
# T2 + T3: tier boundaries
# --------------------------------------------------------------------------

@pytest.mark.parametrize("rep,expected_tier,expected_discount", [
    (0, "Novice", False),
    (4, "Novice", False),
    (5, "Verified", True),
    (9, "Verified", True),
    (10, "Trusted", True),
    (19, "Trusted", True),
    (20, "Elder", True),
    (99, "Elder", True),
])
def test_tier_boundaries(direct_vm, direct_deploy, direct_alice, rep, expected_tier, expected_discount):
    _isolate_storage(direct_vm)
    _clear_known_contracts()

    core = direct_deploy("contracts/gen_squat_core.py")
    direct_vm.warp("2024-05-01T00:00:00+00:00")

    # Direct storage poke — set reputation via the internal TreeMap.
    # `direct_alice` is a raw 20-byte address; wrap in Address for storage keys.
    from genlayer import i256, Address
    alice_addr = Address(direct_alice)
    core.user_reputation[alice_addr] = i256(rep)

    stats = json.loads(core.get_user_stats(alice_addr))
    assert stats["reputation"] == rep
    assert stats["tier"] == expected_tier
    assert stats["stake_discount"] is expected_discount


# --------------------------------------------------------------------------
# T4 + T5: counts + gallery reflect only the queried address's assets
# --------------------------------------------------------------------------

def test_stats_and_gallery_scope_to_owner(direct_vm, direct_deploy, direct_alice, direct_bob):
    _isolate_storage(direct_vm)
    _clear_known_contracts()

    core = direct_deploy("contracts/gen_squat_core.py")
    direct_vm.warp("2024-05-01T00:00:00+00:00")

    # Alice: submits 2 claims, mints 1 SBT
    a1 = _submit_and_analyze(direct_vm, core, direct_alice, "Alice plot A")
    a2 = _submit_and_analyze(direct_vm, core, direct_alice, "Alice plot B")
    _mint(direct_vm, core, direct_alice, a1)

    # Bob: submits 1 claim, mints 1 SBT
    b1 = _submit_and_analyze(direct_vm, core, direct_bob, "Bob plot")
    _mint(direct_vm, core, direct_bob, b1)

    from genlayer import Address
    alice_addr = Address(direct_alice)
    bob_addr = Address(direct_bob)

    alice_stats = json.loads(core.get_user_stats(alice_addr))
    assert alice_stats["claim_count"] == 2
    assert alice_stats["sbt_count"] == 1

    bob_stats = json.loads(core.get_user_stats(bob_addr))
    assert bob_stats["claim_count"] == 1
    assert bob_stats["sbt_count"] == 1

    alice_sbts = json.loads(core.get_user_sbts(alice_addr))
    assert len(alice_sbts) == 1
    assert alice_sbts[0]["claim_id"] == a1
    assert alice_sbts[0]["metadata"]["owner"].lower() == str(alice_addr).lower()

    bob_sbts = json.loads(core.get_user_sbts(bob_addr))
    assert len(bob_sbts) == 1
    assert bob_sbts[0]["claim_id"] == b1

    # a2 was submitted but not minted — must not appear in either gallery.
    assert all(item["claim_id"] != a2 for item in alice_sbts)
    assert all(item["claim_id"] != a2 for item in bob_sbts)
