# Ethereum

In this chapter, we will discuss how the Ethereum light client works, as well as some advanced computer science concepts to understand why our (cryptographic) proofs are correct. We will start by analyzing the light client from afar, observing the full protocol, and then inspecting each individual step.

## Protocol

A light client offers a few public functions that can be called by any party. Each of these functions progresses it's inner state `S`. By this we mean, that calling one of these functions will make the light client store data, which it uses in subsequent operations. 

1. Initialization: can only be called once when creating the client.
2. Updating: succively called for each block we wish to verify
3. Freezing: called once in case of misbehaviour.

`Initialization` often happens during contract deployment. Here we pass the initial state to the contract. This state either includes the genesis block, or an arbitrary block. We refer to this as the 'trusted height', which is trusted by the client to be a correct block. Often a governance proposal is used to verify that this block is correct before passing it to the light client.

# Ethereum Light Client

This chapter explores the architecture and operation of the Ethereum light client, along with the cryptographic foundations that ensure the validity of its proofs. We'll begin with a high-level overview of the protocol before diving into the technical details of each component.

## Protocol Overview

A light client exposes several public functions that can be invoked by external parties. Each function call modifies the client's internal state `S`, storing critical data that informs subsequent operations. The light client lifecycle can be divided into three distinct phases:

1. **Initialization**: Occurs exactly once when the client is created
2. **Updating**: Called repeatedly to verify each new block
3. **Freezing**: Invoked once if malicious behavior is detected

Initialization typically happens during contract deployment for smart contract-based light clients. During this phase, we provide the client with its initial trusted state, which can be either:

- The genesis block of the chain
- A recent, well-established checkpoint block

This initial block is known as the "trusted height" and serves as the foundation for all subsequent verifications. Since this block is assumed to be correct without cryptographic verification within the light client itself, its selection is critical. In production environments, a governance proposal or similar consensus mechanism often validates this block before it's passed to the light client.

Once initialized, the light client can begin verifying new blocks. The update function accepts a block header and associated cryptographic proofs, then:

1. Verifies the header's cryptographic integrity
2. Validates the consensus signatures from the validator set
3. Updates the client's internal state to reflect the new "latest verified block"

Updates can happen in sequence (verifying each block) or can skip intermediate blocks using more complex proof mechanisms. The efficiency of this process is what makes light clients practical for cross-chain communication.

If the light client detects conflicting information or invalid proofs that suggest an attack attempt, it can enter a "frozen" state. This is a safety mechanism that prevents the client from processing potentially fraudulent updates. Recovery from a frozen state typically requires governance intervention.

Since initialization is rather trivial, we will not dive deeper into it. 

### Updating

Since Ethereum is finalized by the beaconchain, our Ethereum light client accepts beacon block data as update input. A [beacon block](https://eth2book.info/capella/part3/containers/blocks/#beacon-blocks) rougly has this structure:

```python
class BeaconBlockBody(Container):
    randao_reveal: BLSSignature
    eth1_data: Eth1Data
    graffiti: Bytes32
    proposer_slashings: List[ProposerSlashing, MAX_PROPOSER_SLASHINGS]
    attester_slashings: List[AttesterSlashing, MAX_ATTESTER_SLASHINGS]
    attestations: List[Attestation, MAX_ATTESTATIONS]
    deposits: List[Deposit, MAX_DEPOSITS]
    voluntary_exits: List[SignedVoluntaryExit, MAX_VOLUNTARY_EXITS]
    sync_aggregate: SyncAggregate 
    execution_payload: ExecutionPayload  
    bls_to_execution_changes: List[SignedBLSToExecutionChange, MAX_BLS_TO_EXECUTION_CHANGES]  
```

We are specifically interested in `sync_aggregate`, which is a structure describing the votes of the sync committee:

```python
class SyncAggregate(Container):
    sync_committee_bits: Bitvector[SYNC_COMMITTEE_SIZE]
    sync_committee_signature: BLSSignature
```

The `sync_committee_bits` indicate which members voted (not all need to vote), and the `sync_committee_signature` is a BLS signature of the members references in the bit vector.

BLS signatures (Boneh-Lynn-Shacham) are a type of cryptographic signature scheme that allows multiple signatures to be aggregated into a single signature. This makes them space and compute efficient (you can aggregate hundreds of signatures into one). Just as we aggregate signatures, we can aggregate public keys as well, such that the aggregate public key can verify the aggregated signature.

For our SyncAggregate, computing the aggregate pubkey is simple:

```python
def _aggregate_pubkeys(committee, bits)
        pubkeys = []
        for i, bit in enumerate(bits):
            if bit:
                pubkeys.append(committee[i])
        return bls.Aggregate(pubkeys)
```

At scale, we can aggregate thousands (if not hundreds of thousands) of signatures and public keys, whily only verifying their aggregates.

To our light client, as long as a majority of sync committee members have attested the block, it is consider final.

```python
class LightClient():
    def update(self, block: BeaconBlockBody):
        
        # Count how many committee members signed
        signature_count = sum(sync_aggregate.sync_committee_bits)
        
        # Need 2/3+ committee participation for finality
        if signature_count < (SYNC_COMMITTEE_SIZE * 2) // 3:
            raise ValueError("Insufficient signatures from sync committee")
        
        # Construct aggregate public key from the current committee and bit vector
        aggregate_pubkey = _aggregate_pubkeys(
            self.current_sync_committee, 
            block.sync_aggregate.sync_committee_bits
        )
        ...
```





<!-- 
class LightClient():
    def __init__(self):
        # Initialize with trusted sync committee
        self.current_sync_committee = None
        self.next_sync_committee = None
        self.latest_block_root = None
        self.latest_slot = 0
        self.finalized = False
    
    def update(self, block: BeaconBlockBody):
        # Get the sync aggregate from the block
        sync_aggregate = block.sync_aggregate
        
        # Count how many committee members signed
        signature_count = sum(sync_aggregate.sync_committee_bits)
        
        # Need 2/3+ committee participation for finality
        if signature_count < (SYNC_COMMITTEE_SIZE * 2) // 3:
            raise ValueError("Insufficient signatures from sync committee")
        
        # Construct aggregate public key from the current committee and bit vector
        aggregate_pubkey = self._aggregate_pubkeys(
            self.current_sync_committee, 
            sync_aggregate.sync_committee_bits
        )
        
        # Construct the signing root that validators are supposed to sign
        signing_root = self._compute_signing_root(block)
        
        # Verify the aggregated signature against the aggregated public key
        if not bls.Verify(
            aggregate_pubkey,
            signing_root,
            sync_aggregate.sync_committee_signature
        ):
            raise ValueError("Invalid sync committee signature")
        
        # If verification passes, update the light client state
        self.latest_block_root = self._compute_block_root(block)
        self.latest_slot = block.slot
        self.finalized = True
        
        # Check if we need to update the sync committee
        if self._is_sync_committee_period_boundary(block.slot):
            self._update_sync_committee(block)
    
    def _aggregate_pubkeys(self, committee, bits):
        """Aggregate public keys based on the bitvector."""
        pubkeys = []
        for i, bit in enumerate(bits):
            if bit:
                pubkeys.append(committee[i])
        return bls.Aggregate(pubkeys)
    
    def _compute_signing_root(self, block):
        """Compute the signing root that validators are supposed to sign."""
        # In actual implementation, this would compute the appropriate domain
        # and combine it with the block root
        domain = self._get_domain(DOMAIN_SYNC_COMMITTEE, block.slot)
        return hash_tree_root(SigningData(
            object_root=self._compute_block_root(block),
            domain=domain
        ))
    
    def _compute_block_root(self, block):
        """Compute the root hash of the block."""
        return hash_tree_root(block)
    
    def _get_domain(self, domain_type, slot):
        """Get the domain for the given domain type and slot."""
        # In a real implementation, this would compute the correct domain
        # based on the fork version at the given slot
        epoch = slot // SLOTS_PER_EPOCH
        fork_version = self._get_fork_version(epoch)
        return compute_domain(domain_type, fork_version)
    
    def _is_sync_committee_period_boundary(self, slot):
        """Check if this slot is a sync committee update boundary."""
        return slot % (SLOTS_PER_EPOCH * EPOCHS_PER_SYNC_COMMITTEE_PERIOD) == 0
    
    def _update_sync_committee(self, block):
        """Update the sync committee using the next sync committee from a block."""
        # In a real implementation, this would extract the next sync committee
        # from a specially crafted block update
        self.current_sync_committee = self.next_sync_committee
        self.next_sync_committee = block.next_sync_committee
    
    def get_latest_block_root(self):
        """Return the latest verified block root."""
        return self.latest_block_root
    
    def is_finalized(self):
        """Check if the light client has a finalized block."""
        return self.finalized 

-->
