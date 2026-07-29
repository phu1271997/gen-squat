from genlayer import *
import json
import hashlib

@gl.contract_interface
class TreasuryInterface:
    class View:
        def get_locked_funds(self, key: str) -> u256: ...
        def get_balance(self, user: Address) -> u256: ...
        def get_treasury_stats(self) -> str: ...
        
    class Write:
        def deposit_claim_stake(self, user: Address, claim_id: str) -> None: ...
        def deposit_dispute_stake(self, user: Address, dispute_key: str) -> None: ...
        def deposit_mint_fee(self) -> None: ...
        def resolve_claim(self, claim_id: str, owner: Address, refund_amount: u256) -> None: ...
        def resolve_dispute(self, claim_id: str, dispute_key: str, challenger: Address, claim_owner: Address, is_overturned: bool, original_refund: u256) -> None: ...

@gl.contract_interface
class NFTInterface:
    class View:
        def get_nft(self, claim_id: str) -> str: ...
        
    class Write:
        def mint_sbt(self, owner: Address, claim_id: str, polygon_json: str, evidence_urls_json: str, ruling_hash: str) -> str: ...

ZERO_ADDR = Address("0x0000000000000000000000000000000000000000")

# Stake / fee constants (native GEN units, 18 decimals)
STAKE_CLAIM = u256(5_000_000_000_000_000_000)       # 5 GEN
STAKE_CLAIM_DISCOUNT = u256(4_000_000_000_000_000_000)  # 4 GEN (rep >= 5)
STAKE_DISPUTE = u256(10_000_000_000_000_000_000)     # 10 GEN
FEE_MINT = u256(2_000_000_000_000_000_000)           # 2 GEN


class Contract(gl.Contract):
    # Core state variables
    claims: TreeMap[str, str]
    claim_rulings: TreeMap[str, str]
    disputes: TreeMap[str, str]
    dispute_rulings: TreeMap[str, str]
    # claim_id -> last dispute_key (used by mint_boundary_nft to look up
    # the FINAL dispute ruling without iterating the disputes map).
    claim_last_dispute: TreeMap[str, str]
    claim_count: u256
    # Standalone stake ledger (used when treasury_address is zero)
    claim_stakes: TreeMap[str, u256]
    dispute_stakes: TreeMap[str, u256]
    withdrawable: TreeMap[Address, u256]
    # SBT metadata stored on core when nft_address is zero (or mirrored)
    boundary_nfts: TreeMap[str, str]
    
    # Contract dependencies (optional — zero address = standalone Studio mode)
    treasury_address: Address
    nft_address: Address
    # Owner + lock flag for dependency injection.
    # Reviewer feedback (audit): any caller could previously replace treasury / NFT
    # dependencies. `set_dependencies` is now owner-only and permanently freezes
    # once `lock_dependencies` is called.
    owner: Address
    deps_locked: bool

    # Reputation & security
    user_reputation: TreeMap[Address, i256]
    user_ban_expiry: TreeMap[Address, u256]

    def __init__(self):
        self.claim_count = u256(0)
        self.treasury_address = ZERO_ADDR
        self.nft_address = ZERO_ADDR
        self.owner = gl.message.sender_address
        self.deps_locked = False

    def _has_treasury(self) -> bool:
        return self.treasury_address != ZERO_ADDR

    def _has_nft(self) -> bool:
        return self.nft_address != ZERO_ADDR

    def _credit(self, who: Address, amount: u256) -> None:
        if amount == u256(0):
            return
        cur = u256(0)
        if who in self.withdrawable:
            cur = self.withdrawable[who]
        self.withdrawable[who] = cur + amount

    def _only_owner(self) -> None:
        if gl.message.sender_address != self.owner:
            raise ValueError("Only the deployer/owner can update contract dependencies")

    @gl.public.write
    def set_dependencies(self, treasury_address: Address, nft_address: Address) -> None:
        """Owner-only dependency injection. Reverts once `lock_dependencies` was called."""
        self._only_owner()
        if self.deps_locked:
            raise ValueError("Dependencies are permanently locked and cannot be replaced")
        self.treasury_address = treasury_address
        self.nft_address = nft_address

    @gl.public.write
    def lock_dependencies(self) -> None:
        """Owner-only. Permanently freezes treasury/NFT addresses to close the audit finding."""
        self._only_owner()
        self.deps_locked = True

    @gl.public.write
    def transfer_ownership(self, new_owner: Address) -> None:
        """Owner-only. Handoff (does not require unlock)."""
        self._only_owner()
        self.owner = new_owner

    def _parse_timestamp(self, dt) -> int:
        if dt is None:
            return 0
        if isinstance(dt, (int, float)):
            return int(dt)
        if isinstance(dt, str):
            try:
                from datetime import datetime
                cleaned = dt.replace("Z", "+00:00")
                return int(datetime.fromisoformat(cleaned).timestamp())
            except Exception:
                pass
        return 0

    def _parse_year(self, dt) -> int:
        if dt is None:
            return 2026
        if isinstance(dt, (int, float)):
            return int(dt)
        if isinstance(dt, str) and len(dt) >= 4:
            try:
                return int(dt[:4])
            except Exception:
                pass
        return 2026

    # Shoelace formula to approximate polygon area in sq meters
    def _calculate_polygon_area_m2(self, polygon: list) -> int:
        n = len(polygon)
        if n < 3:
            return 0
        
        # Centroid calculation for lat scaling
        lat_sum = sum(coord[0] for coord in polygon)
        lat_avg = lat_sum / n
        
        # Scale factors to convert degrees to meters
        # 1 degree lat = 111,139 meters
        # 1 degree lng = 111,139 * cos(lat) meters (approx cos(lat_avg) for HCMC/Hanoi is ~0.95-0.98)
        # Using 0.96 as a good general coefficient for Vietnam latitudes (~10 to ~21 degrees)
        lat_scale = 111139.0
        lng_scale = 111139.0 * 0.96
        
        # Apply Shoelace formula on converted coordinates
        area_sum = 0.0
        for i in range(n):
            j = (i + 1) % n
            x1 = polygon[i][1] * lng_scale
            y1 = polygon[i][0] * lat_scale
            x2 = polygon[j][1] * lng_scale
            y2 = polygon[j][0] * lat_scale
            area_sum += (x1 * y2 - x2 * y1)
            
        area = abs(area_sum) / 2.0
        return int(area)

    def _is_self_intersecting(self, polygon: list) -> bool:
        # Simplified segment intersection check
        def intersect(p1, p2, p3, p4):
            def ccw(a, b, c):
                return (c[0]-a[0])*(b[1]-a[1]) > (b[0]-a[0])*(c[1]-a[1])
            return ccw(p1,p3,p4) != ccw(p2,p3,p4) and ccw(p1,p2,p3) != ccw(p1,p2,p4)

        n = len(polygon)
        for i in range(n):
            for j in range(i + 2, n):
                if i == 0 and j == n - 1:
                    continue
                p1, p2 = polygon[i], polygon[(i+1)%n]
                p3, p4 = polygon[j], polygon[(j+1)%n]
                if intersect(p1, p2, p3, p4):
                    return True
        return False

    @gl.public.write.payable
    def submit_claim(
        self,
        polygon_json: str,
        year_start: int,
        year_end: int,
        description: str,
        land_evidence_url: str,
    ) -> str:
        """
        Register a land boundary claim.
        Payable: 5 GEN stake (4 GEN if reputation >= 5).
        land_evidence_url: public http(s) page with parcel/record/photo notes
        so validators can review concrete evidence via web.render.
        """
        sender = gl.message.sender_address
        current_time = u256(self._parse_timestamp(gl.message_raw.get("datetime")))
        
        # Security checks
        expiry = u256(0)
        if sender in self.user_ban_expiry:
            expiry = self.user_ban_expiry[sender]
            
        if int(expiry) > int(current_time):
            raise ValueError("Sender is currently banned from submitting claims")

        if len(description) == 0:
            raise ValueError("description must not be empty")
        if not land_evidence_url.startswith("http"):
            raise ValueError("land_evidence_url must be a public http(s) URL with reviewable land evidence")
            
        # Parse and validate polygon
        try:
            polygon = json.loads(polygon_json)
        except Exception:
            raise ValueError("polygon_json must be valid JSON")
            
        if not isinstance(polygon, list) or len(polygon) < 3:
            raise ValueError("Polygon must contain at least 3 points")
            
        if self._is_self_intersecting(polygon):
            raise ValueError("Polygon boundaries must not self-intersect")
            
        # Area boundaries check
        area_m2 = self._calculate_polygon_area_m2(polygon)
        if area_m2 > 10000000: # 10 km²
            raise ValueError(f"Polygon area ({area_m2}m²) exceeds maximum allowed size of 10,000,000m²")
        if area_m2 < 10: # 10 m²
            raise ValueError(f"Polygon area ({area_m2}m²) is smaller than minimum allowed size of 10m²")
            
        # Date boundaries validation
        if year_start < 2015:
            raise ValueError("Start year cannot be before 2015 (Sentinel-2 launch)")
        if year_start >= year_end:
            raise ValueError("Start year must be strictly less than end year")
        current_year = self._parse_year(gl.message_raw.get("datetime"))
        # Allow up to current calendar year + 0; clamp max for Studio clock skew
        max_year = max(current_year, 2026)
        if year_end > max_year:
            raise ValueError(f"End year cannot be in the future (max {max_year})")
            
        # Staking validation (5 GEN required)
        stake = gl.message.value
        reputation = i256(0)
        if sender in self.user_reputation:
            reputation = self.user_reputation[sender]
            
        required_stake = STAKE_CLAIM
        if int(reputation) >= 5:
            required_stake = STAKE_CLAIM_DISCOUNT
            
        if stake < required_stake:
            raise ValueError(f"Insufficient stake provided. Required: {int(required_stake) / 10**18} GEN (payable value)")
            
        # Centroid check for double-claim conflicts
        lat_sum = sum(coord[0] for coord in polygon)
        lng_sum = sum(coord[1] for coord in polygon)
        lat = lat_sum / len(polygon)
        lng = lng_sum / len(polygon)
        
        conflict_flag = False
        conflict_with_id = ""
        
        # Check last 10 claims for close distance (within ~50m, approx 0.0005 degrees)
        latest_id = int(self.claim_count)
        start_check = max(1, latest_id - 10)
        for i in range(start_check, latest_id + 1):
            key = f"claim_{i}"
            if key in self.claims:
                prev_json = self.claims[key]
                prev = json.loads(prev_json)
                prev_polygon = prev["polygon"]
                prev_lat = sum(c[0] for c in prev_polygon) / len(prev_polygon)
                prev_lng = sum(c[1] for c in prev_polygon) / len(prev_polygon)
                if abs(lat - prev_lat) < 0.0005 and abs(lng - prev_lng) < 0.0005:
                    conflict_flag = True
                    conflict_with_id = key
                    break
                    
        self.claim_count = u256(int(self.claim_count) + 1)
        claim_id = f"claim_{int(self.claim_count)}"
        
        # Lock stake: Treasury if configured, else standalone ledger on this contract
        if self._has_treasury():
            TreasuryInterface(self.treasury_address).emit(value=stake, on='finalized').deposit_claim_stake(sender, claim_id)
        else:
            self.claim_stakes[claim_id] = stake
        
        # Store claim (includes reviewable land evidence URL for judges / AI)
        claim_data = {
            "id": claim_id,
            "owner": str(sender),
            "polygon": polygon,
            "year_start": year_start,
            "year_end": year_end,
            "description": description,
            "land_evidence_url": land_evidence_url,
            "status": "SUBMITTED",
            "created_at": int(current_time),
            "conflict_flag": conflict_flag,
            "conflict_with": conflict_with_id,
            "area_m2": area_m2,
            "stake_wei": str(int(stake)),
        }
        
        self.claims[claim_id] = json.dumps(claim_data)
        return claim_id

    @gl.public.write
    def analyze_claim(self, claim_id: str) -> str:
        if claim_id not in self.claims:
            raise ValueError("Claim does not exist")
        claim_json = self.claims[claim_id]
            
        claim = json.loads(claim_json)
        if claim["status"] != "SUBMITTED":
            raise ValueError("Claim has already been analyzed or is in dispute")
            
        polygon = claim["polygon"]
        year_start = claim["year_start"]
        year_end = claim["year_end"]
        conflict_flag = claim["conflict_flag"]
        conflict_with_id = claim["conflict_with"]
        land_evidence_url = claim.get("land_evidence_url", "")
        description = claim.get("description", "")
        
        # Bounding box bounds
        min_lat = min(c[0] for c in polygon)
        max_lat = max(c[0] for c in polygon)
        min_lng = min(c[1] for c in polygon)
        max_lng = max(c[1] for c in polygon)
        
        # Define nested consensus task
        def task_fn():
            # Primary reviewable land record (public HTML sample or cadastral page)
            land_page_text = ""
            if land_evidence_url:
                try:
                    land_page_text = gl.nondet.web.render(land_evidence_url, mode="text")[:5000]
                except Exception:
                    land_page_text = "LAND_EVIDENCE_URL_UNREACHABLE"

            api_data = []
            # Cap year span to keep Studio consensus tractable (first, mid, last)
            years = list(range(year_start, year_end + 1))
            if len(years) > 3:
                years = [years[0], years[len(years) // 2], years[-1]]
            for year in years:
                # 1. OpenStreetMap Overpass Attic Query
                overpass_url = f"https://overpass-api.de/api/interpreter?data=[out:json][date:\"{year}-07-01T00:00:00Z\"];way({min_lat},{min_lng},{max_lat},{max_lng});out;"
                try:
                    osm_text = gl.nondet.web.render(overpass_url, mode="text")
                except Exception:
                    osm_text = "OSM_UNREACHABLE"
                
                # 2. Planetary Computer STAC Search
                stac_url = f"https://planetarycomputer.microsoft.com/api/stac/v1/search?bbox={min_lng},{min_lat},{max_lng},{max_lat}&collections=sentinel-2-l2a&datetime={year}-01-01T00:00:00Z/{year}-12-31T23:59:59Z&limit=1"
                try:
                    stac_text = gl.nondet.web.render(stac_url, mode="text")
                except Exception:
                    stac_text = "STAC_UNREACHABLE"
                
                api_data.append({
                    "year": year,
                    "osm_data": osm_text[:1500],
                    "stac_data": stac_text[:1500]
                })

            system_prompt = (
                "You are an on-chain AI geospatial forensics consensus node. Your task is to detect land encroachment "
                "by analyzing historical spatial data and a public land evidence record.\n\n"
                "INPUT METADATA:\n"
                f"- Claim description: {description}\n"
                f"- Land evidence URL: {land_evidence_url}\n"
                f"- Bounding Box: [{min_lng}, {min_lat}, {max_lng}, {max_lat}]\n"
                f"- Target Polygon coordinates: {polygon}\n"
                f"- Overlap conflict flag: {conflict_flag} (Conflict with: {conflict_with_id})\n\n"
                "LAND EVIDENCE PAGE CONTENT:\n"
                f"{land_page_text}\n\n"
                "INSTRUCTIONS:\n"
                "1. Use the land evidence page as primary human-reviewable context (parcel id, area, fence notes, photos).\n"
                "2. Study OSM Attic ways and STAC records for structural change over the year timeline.\n"
                "3. If the land evidence page describes a fence shift / road widening inside the polygon, weight that heavily.\n"
                "4. Estimate area lost in m²; provide confidence 0.0-1.0 and year-by-year timeline.\n"
                "5. Always include land_evidence_url in evidence_urls.\n\n"
                "OUTPUT FORMAT — STRICT JSON:\n"
                "{\n"
                "  \"encroachment_detected\": true/false,\n"
                "  \"area_lost_m2\": <number>,\n"
                "  \"confidence\": <0.0 to 1.0>,\n"
                "  \"timeline\": [\n"
                "    {\"year\": <int>, \"status\": \"clean|minor|significant|severe\", \"detail\": \"<string>\"},\n"
                "    ...\n"
                "  ],\n"
                "  \"evidence_urls\": [\"<url1>\", \"<url2>\", ...],\n"
                "  \"reasoning\": \"<detailed analysis>\"\n"
                "}"
            )
            
            prompt = f"{system_prompt}\n\nDATA TIMELINE:\n{json.dumps(api_data, indent=2)}"
            return json.dumps(gl.nondet.exec_prompt(prompt, response_format="json"))

        # Execute comparative consensus
        principle = (
            "Validators MUST agree on: "
            "(1) encroachment_detected boolean (exact match required). "
            "(2) area_lost_m2 within 15% relative deviation. "
            "(3) confidence within 0.15 absolute deviation. "
            "If the final verdict differs between validators, consensus MUST fail."
        )
        
        ruling_str = gl.eq_principle.prompt_comparative(task_fn, principle)
        
        # Save ruling and update claim
        self.claim_rulings[claim_id] = ruling_str
        
        claim["status"] = "ANALYZED"
        claim["analyzed_at"] = self._parse_timestamp(gl.message_raw.get("datetime"))
        self.claims[claim_id] = json.dumps(claim)
        
        return ruling_str

    @gl.public.write
    def claim_refund(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise ValueError("Claim does not exist")
        claim_json = self.claims[claim_id]
            
        claim = json.loads(claim_json)
        if claim["status"] != "ANALYZED":
            raise ValueError("Claim is not in a refundable state")
            
        current_time = self._parse_timestamp(gl.message_raw.get("datetime"))
        # 5 minutes dispute window (300 seconds)
        if current_time < claim["analyzed_at"] + 300:
            raise ValueError(f"Dispute window is still open. Wait {claim['analyzed_at'] + 300 - current_time} more seconds")
            
        if claim_id not in self.claim_rulings:
            raise ValueError("Ruling does not exist")
        ruling_json = self.claim_rulings[claim_id]
        ruling = json.loads(ruling_json)
        confidence = float(ruling["confidence"])
        
        # Refund owner 100% if confidence >= 0.7, else 50% of the locked claim stake
        owner = Address(claim["owner"])
        locked = STAKE_CLAIM
        if claim_id in self.claim_stakes:
            locked = self.claim_stakes[claim_id]
        refund_amount = locked if confidence >= 0.7 else (locked // u256(2))
        
        if self._has_treasury():
            TreasuryInterface(self.treasury_address).emit(on='finalized').resolve_claim(claim_id, owner, refund_amount)
        else:
            self._credit(owner, refund_amount)
            self.claim_stakes[claim_id] = u256(0)
        
        claim["status"] = "RESOLVED"
        self.claims[claim_id] = json.dumps(claim)

    @gl.public.write.payable
    def dispute_claim(self, claim_id: str, challenge_reason: str) -> str:
        """Payable: 10 GEN dispute stake. challenge_reason is free-text (not JSON)."""
        if claim_id not in self.claims:
            raise ValueError("Claim does not exist")
        claim_json = self.claims[claim_id]
            
        claim = json.loads(claim_json)
        if claim["status"] != "ANALYZED":
            raise ValueError("Claim cannot be disputed (either resolved or not analyzed yet)")

        if len(challenge_reason) == 0:
            raise ValueError("challenge_reason must not be empty")
            
        sender = gl.message.sender_address
        stake = gl.message.value
        if stake < STAKE_DISPUTE:
            raise ValueError("Minimum dispute stake of 10 GEN is required (payable value)")
            
        dispute_key = f"dispute_{claim_id}_{sender}"
        if dispute_key in self.disputes:
            raise ValueError("You have already disputed this claim")
            
        if self._has_treasury():
            TreasuryInterface(self.treasury_address).emit(value=stake, on='finalized').deposit_dispute_stake(sender, dispute_key)
        else:
            self.dispute_stakes[dispute_key] = stake
        
        # Save dispute entry
        dispute_entry = {
            "claim_id": claim_id,
            "challenger": str(sender),
            "reason": challenge_reason,
            "created_at": self._parse_timestamp(gl.message_raw.get("datetime"))
        }
        self.disputes[dispute_key] = json.dumps(dispute_entry)
        
        # Update claim state
        claim["status"] = "DISPUTED"
        self.claims[claim_id] = json.dumps(claim)
        
        # Retrieve original ruling
        if claim_id not in self.claim_rulings:
            raise ValueError("Claim ruling must exist to dispute it")
        ruling_json = self.claim_rulings[claim_id]
        
        polygon = claim["polygon"]
        year_start = claim["year_start"]
        year_end = claim["year_end"]
        min_lat = min(c[0] for c in polygon)
        max_lat = max(c[0] for c in polygon)
        min_lng = min(c[1] for c in polygon)
        max_lng = max(c[1] for c in polygon)

        # Run comparative arbitration
        def dispute_task_fn():
            api_data = []
            for year in range(year_start, year_end + 1):
                overpass_url = f"https://overpass-api.de/api/interpreter?data=[out:json][date:\"{year}-07-01T00:00:00Z\"];way({min_lat},{min_lng},{max_lat},{max_lng});out;"
                osm_text = gl.nondet.web.render(overpass_url, mode="text")
                api_data.append({
                    "year": year,
                    "osm_data": osm_text[:2000]
                })

            system_prompt = (
                "You are a senior geospatial forensics arbitrator resolving a disputed encroachment case.\n\n"
                "INPUT DATA:\n"
                f"- Polygon bounds: {polygon}\n"
                f"- Original Ruling: {ruling_json}\n"
                f"- Challenger's Objection: {challenge_reason}\n\n"
                "INSTRUCTIONS:\n"
                "1. Review the original ruling and the challenger's objection.\n"
                "2. Analyze the historical OSM ways data timeline to check if the encroachment detected is accurate.\n"
                "3. Make a final verdict: output \"OVERTURN\" if the original ruling is incorrect (e.g. false positive/negative), or \"UPHOLD\" if the original ruling is correct.\n\n"
                "OUTPUT FORMAT — STRICT JSON:\n"
                "{\n"
                "  \"dispute_verdict\": \"UPHOLD|OVERTURN\",\n"
                "  \"encroachment_detected\": true/false,\n"
                "  \"area_lost_m2\": <number>,\n"
                "  \"confidence\": <0.0 to 1.0>,\n"
                "  \"reasoning\": \"<detailed explanation>\"\n"
                "}"
            )
            prompt = f"{system_prompt}\n\nDATA TIMELINE:\n{json.dumps(api_data, indent=2)}"
            return json.dumps(gl.nondet.exec_prompt(prompt, response_format="json"))

        dispute_principle = (
            "Validators MUST agree on: "
            "(1) dispute_verdict string (exact match required: UPHOLD or OVERTURN). "
            "(2) encroachment_detected boolean (exact match required). "
            "(3) confidence within 0.15 absolute deviation."
        )
        
        final_ruling_str = gl.eq_principle.prompt_comparative(dispute_task_fn, dispute_principle)
        self.dispute_rulings[dispute_key] = final_ruling_str
        # Track the latest dispute per claim so mint_boundary_nft can locate
        # the final ruling without iterating the TreeMap.
        self.claim_last_dispute[claim_id] = dispute_key
        
        # Process stakes based on verdict
        final_ruling = json.loads(final_ruling_str)
        verdict = final_ruling["dispute_verdict"]
        
        claim_owner = Address(claim["owner"])
        original_ruling = json.loads(ruling_json)
        original_conf = float(original_ruling["confidence"])
        locked_claim = STAKE_CLAIM
        if claim_id in self.claim_stakes:
            locked_claim = self.claim_stakes[claim_id]
        original_refund = locked_claim if original_conf >= 0.7 else (locked_claim // u256(2))
        
        is_overturned = (verdict == "OVERTURN")
        
        if self._has_treasury():
            TreasuryInterface(self.treasury_address).emit(on='finalized').resolve_dispute(
                claim_id, dispute_key, sender, claim_owner, is_overturned, original_refund
            )
        else:
            # Standalone stake split: overturn → challenger gets dispute stake + claim stake remainder;
            # uphold → owner gets original_refund, dispute stake forfeited to surplus (stay in contract).
            dispute_locked = STAKE_DISPUTE
            if dispute_key in self.dispute_stakes:
                dispute_locked = self.dispute_stakes[dispute_key]
            if is_overturned:
                self._credit(sender, dispute_locked + locked_claim)
            else:
                self._credit(claim_owner, original_refund)
            self.claim_stakes[claim_id] = u256(0)
            self.dispute_stakes[dispute_key] = u256(0)
        
        # Update reputations and ban status
        current_rep = i256(0)
        if sender in self.user_reputation:
            current_rep = self.user_reputation[sender]
        self.user_reputation[sender] = current_rep + i256(2) if is_overturned else current_rep - i256(2)
        
        owner_rep = i256(0)
        if claim_owner in self.user_reputation:
            owner_rep = self.user_reputation[claim_owner]
            
        if is_overturned:
            new_owner_rep = owner_rep - i256(2)
            self.user_reputation[claim_owner] = new_owner_rep
            if int(new_owner_rep) < -3:
                # Ban for 30 days (2,592,000 seconds)
                self.user_ban_expiry[claim_owner] = u256(self._parse_timestamp(gl.message_raw.get("datetime")) + 2592000)
            claim["status"] = "RESOLVED_OVERTURNED"
        else:
            self.user_reputation[claim_owner] = owner_rep + i256(1)
            claim["status"] = "RESOLVED_UPHELD"
            
        self.claims[claim_id] = json.dumps(claim)
        return final_ruling_str

    @gl.public.write.payable
    def mint_boundary_nft(self, claim_id: str) -> str:
        """Payable: 2 GEN mint fee. Allowed after ANALYZED / RESOLVED_UPHELD with confidence >= 0.8.

        Reviewer feedback (audit): an overturned claim previously minted the
        superseded original ruling. Now the mint source is chosen from the
        FINAL dispute ruling when the claim was disputed, and RESOLVED_OVERTURNED
        claims whose final verdict flipped the outcome cannot mint at all.
        """
        if gl.message.value < FEE_MINT:
            raise ValueError("Mint fee of 2 GEN is required (payable value)")

        if claim_id not in self.claims:
            raise ValueError("Claim does not exist")
        claim_json = self.claims[claim_id]

        claim = json.loads(claim_json)
        allowed_status = ("ANALYZED", "RESOLVED", "RESOLVED_UPHELD", "RESOLVED_OVERTURNED")
        if claim["status"] not in allowed_status:
            raise ValueError("NFT can only be minted after analysis (or full resolution)")

        if claim_id not in self.claim_rulings:
            raise ValueError("Ruling does not exist for this claim")

        # Locate the final dispute ruling (if any) via the per-claim index.
        final_dispute_key = ""
        final_dispute_json = ""
        if claim_id in self.claim_last_dispute:
            final_dispute_key = self.claim_last_dispute[claim_id]
            if final_dispute_key in self.dispute_rulings:
                final_dispute_json = self.dispute_rulings[final_dispute_key]

        # Decide the source-of-truth ruling for the SBT.
        # - RESOLVED_OVERTURNED: the original ruling was proven wrong. The SBT
        #   MUST reflect the arbitrator's final verdict, not the superseded one.
        #   If the final verdict flipped the encroachment_detected bit, the
        #   original ruling's claim is meaningless as evidence — block the mint.
        # - RESOLVED_UPHELD / ANALYZED / RESOLVED: mint from the original ruling.
        source_ruling_json = self.claim_rulings[claim_id]
        used_final_dispute = False

        if claim["status"] == "RESOLVED_OVERTURNED":
            if not final_dispute_json:
                raise ValueError("Overturned claim has no dispute ruling on record — cannot mint")
            original_ruling = json.loads(self.claim_rulings[claim_id])
            final_ruling = json.loads(final_dispute_json)
            if bool(original_ruling.get("encroachment_detected")) != bool(final_ruling.get("encroachment_detected")):
                raise ValueError(
                    "Cannot mint boundary SBT: the final dispute ruling overturned the original "
                    "encroachment verdict. Minting the original credential would misrepresent the case."
                )
            # Verdicts agree on the bit; use the final dispute ruling as the credential source
            source_ruling_json = final_dispute_json
            used_final_dispute = True

        ruling = json.loads(source_ruling_json)
        if float(ruling["confidence"]) < 0.8:
            raise ValueError(f"Ruling confidence ({ruling['confidence']}) must be >= 0.8 to mint NFT")

        if claim_id in self.boundary_nfts and self.boundary_nfts[claim_id] != "":
            raise ValueError("Boundary NFT already minted for this claim")

        # Hash the SOURCE ruling (final dispute ruling on overturned-but-agreeing cases)
        ruling_hash = hashlib.sha256(source_ruling_json.encode("utf-8")).hexdigest()

        evidence_urls = ruling.get("evidence_urls", [])
        land_url = claim.get("land_evidence_url", "")
        if land_url and land_url not in evidence_urls:
            evidence_urls = [land_url] + list(evidence_urls)

        token_id = f"sbt_{claim_id}"
        metadata = {
            "token_id": token_id,
            "owner": claim["owner"],
            "claim_id": claim_id,
            "polygon": claim["polygon"],
            "land_evidence_url": land_url,
            "evidence_urls": evidence_urls,
            "ruling_hash": ruling_hash,
            "confidence": ruling.get("confidence"),
            "encroachment_detected": ruling.get("encroachment_detected"),
            "source": "dispute_ruling" if used_final_dispute else "original_ruling",
            "dispute_key": final_dispute_key,
        }
        metadata_str = json.dumps(metadata, sort_keys=True)
        self.boundary_nfts[claim_id] = metadata_str
        
        if self._has_treasury():
            TreasuryInterface(self.treasury_address).emit(value=gl.message.value, on='finalized').deposit_mint_fee()
        # else mint fee stays in contract (protocol fee)

        if self._has_nft():
            NFTInterface(self.nft_address).emit(on='finalized').mint_sbt(
                Address(claim["owner"]),
                claim_id,
                json.dumps(claim["polygon"]),
                json.dumps(evidence_urls),
                ruling_hash
            )
        
        return ruling_hash

    @gl.public.write
    def withdraw(self) -> None:
        """Pull-payment of standalone refunds/credits (when treasury is not configured)."""
        sender = gl.message.sender_address
        amount = u256(0)
        if sender in self.withdrawable:
            amount = self.withdrawable[sender]
        if amount == u256(0):
            raise ValueError("Nothing to withdraw")
        self.withdrawable[sender] = u256(0)
        gl.get_contract_at(sender).emit_transfer(value=amount)

    # View Getters
    @gl.public.view
    def get_claim_count(self) -> u256:
        return self.claim_count

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        if claim_id not in self.claims:
            raise ValueError("Claim does not exist")
        return self.claims[claim_id]

    @gl.public.view
    def get_ruling(self, claim_id: str) -> str:
        if claim_id not in self.claim_rulings:
            raise ValueError("Ruling does not exist")
        return self.claim_rulings[claim_id]

    @gl.public.view
    def get_dispute(self, dispute_key: str) -> str:
        if dispute_key not in self.disputes:
            raise ValueError("Dispute does not exist")
        return self.disputes[dispute_key]

    @gl.public.view
    def get_dispute_ruling(self, dispute_key: str) -> str:
        if dispute_key not in self.dispute_rulings:
            raise ValueError("Dispute ruling does not exist")
        return self.dispute_rulings[dispute_key]

    @gl.public.view
    def get_boundary_nft(self, claim_id: str) -> str:
        if claim_id not in self.boundary_nfts or self.boundary_nfts[claim_id] == "":
            raise ValueError("Boundary NFT does not exist for this claim")
        return self.boundary_nfts[claim_id]

    @gl.public.view
    def get_withdrawable(self, who: Address) -> u256:
        if who in self.withdrawable:
            return self.withdrawable[who]
        return u256(0)

    @gl.public.view
    def get_user_stats(self, user: Address) -> str:
        reputation = i256(0)
        if user in self.user_reputation:
            reputation = self.user_reputation[user]
            
        expiry = u256(0)
        if user in self.user_ban_expiry:
            expiry = self.user_ban_expiry[user]
            
        stats = {
            "reputation": int(reputation),
            "ban_expiry": int(expiry)
        }
        return json.dumps(stats)

    @gl.public.view
    def get_contract_info(self) -> str:
        return json.dumps({
            "name": "GenSquat Core",
            "source": "contracts/gen_squat_core.py",
            "payable": {
                "submit_claim": "5 GEN",
                "dispute_claim": "10 GEN",
                "mint_boundary_nft": "2 GEN",
            },
            "methods": [
                "submit_claim",
                "analyze_claim",
                "claim_refund",
                "dispute_claim",
                "mint_boundary_nft",
                "withdraw",
                "get_claim",
                "get_ruling",
                "get_claim_count",
                "get_boundary_nft",
                "get_contract_info",
            ],
            "workflow": [
                "submit_claim(+5 GEN, polygon + land_evidence_url)",
                "analyze_claim (AI jury reads land evidence + OSM/STAC)",
                "dispute_claim(+10 GEN) optional",
                "mint_boundary_nft(+2 GEN) if confidence >= 0.8",
            ],
            "standalone_mode": "treasury/nft zero-address OK for Studio demos",
        })
