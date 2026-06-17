# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

@gl.evm.contract_interface
class TreasuryInterface:
    class View:
        def get_locked_funds(self, key: str, /) -> u256: ...
        def get_balance(self, user: Address, /) -> u256: ...
        def get_treasury_stats(self, /) -> str: ...
        
    class Write:
        def deposit_claim_stake(self, user: Address, claim_id: str, /) -> None: ...
        def deposit_dispute_stake(self, user: Address, dispute_key: str, /) -> None: ...
        def deposit_mint_fee(self, /) -> None: ...
        def resolve_claim(self, claim_id: str, owner: Address, refund_amount: u256, /) -> None: ...
        def resolve_dispute(self, claim_id: str, dispute_key: str, challenger: Address, claim_owner: Address, is_overturned: bool, original_refund: u256, /) -> None: ...

@gl.evm.contract_interface
class NFTInterface:
    class View:
        def get_nft(self, claim_id: str, /) -> str: ...
        
    class Write:
        def mint_sbt(self, owner: Address, claim_id: str, polygon_json: str, evidence_urls_json: str, ruling_hash: str, /) -> str: ...

class Contract(gl.Contract):
    # Core state variables
    claims: TreeMap[str, str]
    claim_rulings: TreeMap[str, str]
    disputes: TreeMap[str, str]
    dispute_rulings: TreeMap[str, str]
    claim_count: u256
    
    # Contract dependencies
    treasury_address: Address
    nft_address: Address
    
    # Reputation & security
    user_reputation: TreeMap[Address, i256]
    user_ban_expiry: TreeMap[Address, u256]

    def __init__(self):
        self.claim_count = u256(0)
        self.treasury_address = Address("0x0000000000000000000000000000000000000000")
        self.nft_address = Address("0x0000000000000000000000000000000000000000")

    @gl.public.write
    def set_dependencies(self, treasury_address: Address, nft_address: Address) -> None:
        # Allows updating dependencies if needed during setup
        self.treasury_address = treasury_address
        self.nft_address = nft_address

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
    def submit_claim(self, polygon_json: str, year_start: int, year_end: int, description: str) -> str:
        sender = gl.message.sender_address
        current_time = u256(self._parse_timestamp(gl.message_raw.get("datetime")))
        
        # Security checks
        expiry = u256(0)
        if sender in self.user_ban_expiry:
            expiry = self.user_ban_expiry[sender]
            
        if int(expiry) > int(current_time):
            raise ValueError("Sender is currently banned from submitting claims")
            
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
        if year_end > current_year:
            raise ValueError(f"End year cannot be in the future (max {current_year})")
            
        # Staking validation (5 GEN required)
        stake = gl.message.value
        # If user has good reputation (>= 5), give a 20% discount on stake
        reputation = i256(0)
        if sender in self.user_reputation:
            reputation = self.user_reputation[sender]
            
        required_stake = u256(5_000_000_000_000_000_000) # 5 GEN
        if int(reputation) >= 5:
            required_stake = u256(4_000_000_000_000_000_000) # 4 GEN
            
        if stake < required_stake:
            raise ValueError(f"Insufficient stake provided. Required: {int(required_stake) / 10**18} GEN")
            
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
                    
        # Lock stake in Treasury
        self.claim_count = u256(int(self.claim_count) + 1)
        claim_id = f"claim_{int(self.claim_count)}"
        
        # Call Treasury
        TreasuryInterface(self.treasury_address).emit(value=stake, on='finalized').deposit_claim_stake(sender, claim_id)
        
        # Store claim
        claim_data = {
            "id": claim_id,
            "owner": str(sender),
            "polygon": polygon,
            "year_start": year_start,
            "year_end": year_end,
            "description": description,
            "status": "SUBMITTED",
            "created_at": int(current_time),
            "conflict_flag": conflict_flag,
            "conflict_with": conflict_with_id,
            "area_m2": area_m2
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
        
        # Bounding box bounds
        min_lat = min(c[0] for c in polygon)
        max_lat = max(c[0] for c in polygon)
        min_lng = min(c[1] for c in polygon)
        max_lng = max(c[1] for c in polygon)
        
        # Define nested consensus task
        def task_fn():
            api_data = []
            for year in range(year_start, year_end + 1):
                # 1. OpenStreetMap Overpass Attic Query
                overpass_url = f"https://overpass-api.de/api/interpreter?data=[out:json][date:\"{year}-07-01T00:00:00Z\"];way({min_lat},{min_lng},{max_lat},{max_lng});out;"
                osm_text = gl.nondet.web.render(overpass_url, mode="text")
                
                # 2. Planetary Computer STAC Search
                stac_url = f"https://planetarycomputer.microsoft.com/api/stac/v1/search?bbox={min_lng},{min_lat},{max_lng},{max_lat}&collections=sentinel-2-l2a&datetime={year}-01-01T00:00:00Z/{year}-12-31T23:59:59Z&limit=1"
                stac_text = gl.nondet.web.render(stac_url, mode="text")
                
                api_data.append({
                    "year": year,
                    "osm_data": osm_text[:2000],  # trim long outputs for context efficiency
                    "stac_data": stac_text[:2000]
                })

            system_prompt = (
                "You are an on-chain AI geospatial forensics consensus node. Your task is to detect land encroachment "
                "by analyzing historical spatial data.\n\n"
                "INPUT METADATA:\n"
                f"- Bounding Box: [{min_lng}, {min_lat}, {max_lng}, {max_lat}]\n"
                f"- Target Polygon coordinates: {polygon}\n"
                f"- Overlap conflict flag: {conflict_flag} (Conflict with: {conflict_with_id})\n\n"
                "INSTRUCTIONS:\n"
                "1. Study the OpenStreetMap Attic way records for each year. Look for structural elements (buildings, fences, barriers) appearing inside the polygon boundary.\n"
                "2. Study the Planetary Computer STAC satellite item records. Look for cloud cover patterns, capture dates, and verify the existence of clean imagery assets.\n"
                "3. Perform year-over-year temporal reasoning: if new roads, fences, or structures appear inside the polygon coordinates over time, classify it as encroachment.\n"
                "4. Estimate the area lost in square meters based on building sizes/fences.\n"
                "5. Provide a confidence score (0.0 to 1.0) and year-by-year status timeline.\n\n"
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
        
        # Refund owner 100% if confidence >= 0.7, else 50%
        owner = Address(claim["owner"])
        refund_amount = u256(5_000_000_000_000_000_000) if confidence >= 0.7 else u256(2_500_000_000_000_000_000)
        
        # Call Treasury to resolve
        TreasuryInterface(self.treasury_address).emit(on='finalized').resolve_claim(claim_id, owner, refund_amount)
        
        claim["status"] = "RESOLVED"
        self.claims[claim_id] = json.dumps(claim)

    @gl.public.write.payable
    def dispute_claim(self, claim_id: str, challenge_reason: str) -> str:
        if claim_id not in self.claims:
            raise ValueError("Claim does not exist")
        claim_json = self.claims[claim_id]
            
        claim = json.loads(claim_json)
        if claim["status"] != "ANALYZED":
            raise ValueError("Claim cannot be disputed (either resolved or not analyzed yet)")
            
        sender = gl.message.sender_address
        stake = gl.message.value
        # 10 GEN required for disputes
        if stake < u256(10_000_000_000_000_000_000):
            raise ValueError("Minimum dispute stake of 10 GEN is required")
            
        dispute_key = f"dispute_{claim_id}_{sender}"
        if dispute_key in self.disputes:
            raise ValueError("You have already disputed this claim")
            
        # Lock dispute stake in Treasury
        TreasuryInterface(self.treasury_address).emit(value=stake, on='finalized').deposit_dispute_stake(sender, dispute_key)
        
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
        
        # Process stakes based on verdict
        final_ruling = json.loads(final_ruling_str)
        verdict = final_ruling["dispute_verdict"]
        
        claim_owner = Address(claim["owner"])
        original_ruling = json.loads(ruling_json)
        original_conf = float(original_ruling["confidence"])
        original_refund = u256(5_000_000_000_000_000_000) if original_conf >= 0.7 else u256(2_500_000_000_000_000_000)
        
        is_overturned = (verdict == "OVERTURN")
        
        # Trigger Treasury payouts
        TreasuryInterface(self.treasury_address).emit(on='finalized').resolve_dispute(
            claim_id, dispute_key, sender, claim_owner, is_overturned, original_refund
        )
        
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
        # Require 2 GEN mint fee
        if gl.message.value < u256(2_000_000_000_000_000_000):
            raise ValueError("Mint fee of 2 GEN is required")
            
        if claim_id not in self.claims:
            raise ValueError("Claim does not exist")
        claim_json = self.claims[claim_id]
            
        claim = json.loads(claim_json)
        if claim["status"] not in ["RESOLVED", "RESOLVED_UPHELD"]:
            raise ValueError("NFT can only be minted for fully resolved, non-fraudulent claims")
            
        if claim_id not in self.claim_rulings:
            raise ValueError("Ruling does not exist for this claim")
        ruling_json = self.claim_rulings[claim_id]
        ruling = json.loads(ruling_json)
        if float(ruling["confidence"]) < 0.8:
            raise ValueError(f"Ruling confidence ({ruling['confidence']}) must be >= 0.8 to mint NFT")
            
        # Hash ruling to serve as proof
        import hashlib
        ruling_hash = hashlib.sha256(ruling_json.encode("utf-8")).hexdigest()
        
        # Forward mint fee to Treasury surplus
        TreasuryInterface(self.treasury_address).emit(value=gl.message.value, on='finalized').deposit_mint_fee()
        
        # Trigger NFT Contract minting
        NFTInterface(self.nft_address).emit(on='finalized').mint_sbt(
            Address(claim["owner"]),
            claim_id,
            json.dumps(claim["polygon"]),
            json.dumps(ruling.get("evidence_urls", [])),
            ruling_hash
        )
        
        return ruling_hash

    # View Getters
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
