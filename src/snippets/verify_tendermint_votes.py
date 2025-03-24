import base64
import json
from typing import List, Dict, Any
import nacl.signing

def verify_tendermint_votes(block_data: Dict[Any, Any]) -> bool:
    """Verifies validator signatures for a Tendermint block."""
    # Extract block ID and validator votes
    block_id = block_data["block_id"]["hash"]
    precommits = block_data["last_commit"]["signatures"]
    validators = block_data["validators"]
    
    # Track validation results
    valid_votes = 0
    total_votes = len(precommits)
    
    for vote in precommits:
        if vote["signature"] is None:
            continue
            
        validator_idx = vote["validator_address"]
        validator_pubkey = validators[validator_idx]["pub_key"]["value"]
        
        # Decode signature and public key
        signature = base64.b64decode(vote["signature"])
        pubkey = base64.b64decode(validator_pubkey)
        
        # Create vote message (block ID + vote data)
        vote_data = {
            "type": "precommit",
            "height": block_data["header"]["height"],
            "round": vote["round"],
            "block_id": block_id,
            "timestamp": vote["timestamp"],
            "validator_address": validator_idx
        }
        msg = json.dumps(vote_data, sort_keys=True).encode()
        
        # ANCHOR: verify-signature
        verify_key = nacl.signing.VerifyKey(pubkey)
        try:
            verify_key.verify(msg, signature)
            valid_votes += 1
        except nacl.exceptions.BadSignatureError:
            pass
        # ANCHOR_END: verify-signature

    # Return true if 2/3+ of validators had valid signatures
    return valid_votes >= (2 * total_votes // 3 + 1)