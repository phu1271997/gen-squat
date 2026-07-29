from genlayer import *
import json

class Contract(gl.Contract):
    # Deployer owner address
    owner: Address
    # Core contract address authorized to mint
    core_address: Address
    # Mapping of token_id -> JSON NFT metadata
    nfts: TreeMap[str, str]

    def __init__(self):
        # Set deployer as owner
        self.owner = gl.message.sender_address
        # Core address initialized to zero address, updated later
        self.core_address = Address("0x0000000000000000000000000000000000000000")

    @gl.public.write
    def set_core_address(self, core_address: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise ValueError("Only owner can set core address")
        self.core_address = core_address

    @gl.public.write
    def mint_sbt(self, owner: Address, claim_id: str, polygon_json: str, evidence_urls_json: str, ruling_hash: str) -> str:
        # Check authorization
        if gl.message.sender_address != self.core_address:
            raise ValueError("Only the core GenSquat contract is authorized to mint")
            
        token_id = f"sbt_{claim_id}"
        if token_id in self.nfts and self.nfts[token_id]:
            raise ValueError("SBT has already been minted for this claim")
            
        # Parse inputs for structure safety
        polygon = json.loads(polygon_json)
        evidence_urls = json.loads(evidence_urls_json)
        
        # Build metadata
        metadata = {
            "token_id": token_id,
            "owner": str(owner),
            "claim_id": claim_id,
            "polygon": polygon,
            "evidence_urls": evidence_urls,
            "ruling_hash": ruling_hash,
            "minted_at": int(gl.message_raw.get("datetime", 0))
        }
        
        metadata_str = json.dumps(metadata)
        self.nfts[token_id] = metadata_str
        return token_id

    @gl.public.view
    def get_nft(self, claim_id: str) -> str:
        token_id = f"sbt_{claim_id}"
        if token_id not in self.nfts or not self.nfts[token_id]:
            raise ValueError("NFT does not exist for this claim")
        return self.nfts[token_id]
