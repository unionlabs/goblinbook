# Ethereum Light Client

This chapter explores the architecture and operation of the Ethereum light client, along with the cryptographic foundations that ensure the validity of its proofs. We'll begin with a high-level overview of the protocol before diving into the technical details of each component.

## Protocol Overview

A light client exposes several public functions that can be invoked by external parties. Each function call modifies the client's internal state `S`, storing critical data that informs subsequent operations. The light client lifecycle can be divided into three distinct phases:

1. **Initialization**: Occurs exactly once when the client is created
1. **Updating**: Called repeatedly to verify each new block
1. **Freezing**: Invoked once if malicious behavior is detected

Initialization typically happens during contract deployment for smart contract-based light clients. During this phase, we provide the client with its initial trusted state, which can be either:

- The genesis block of the chain
- A recent, well-established checkpoint block

This initial block is known as the "trusted height" and serves as the foundation for all subsequent verifications. Since this block is assumed to be correct without cryptographic verification within the light client itself, its selection is critical. In production environments, a governance proposal or similar consensus mechanism often validates this block before it's passed to the light client.

Once initialized, the light client can begin verifying new blocks. The update function accepts a block header and associated cryptographic proofs, then:

1. Verifies the header's cryptographic integrity
1. Validates the consensus signatures from the sync committee
1. Updates the client's internal state to reflect the new "latest verified block"

Updates can happen in sequence (verifying each block) or can skip intermediate blocks using more complex proof mechanisms. The efficiency of this process is what makes light clients practical for cross-chain communication.

If the light client detects conflicting information or invalid proofs that suggest an attack attempt, it can enter a "frozen" state. This is a safety mechanism that prevents the client from processing potentially fraudulent updates. Recovery from a frozen state typically requires governance intervention.

Since initialization is rather trivial, we will not dive deeper into it.

### Updating

Since Ethereum is finalized by the Beacon Chain, our Ethereum light client accepts beacon block data as update input. A [beacon block](https://eth2book.info/capella/part3/containers/blocks/#beacon-blocks) roughly has this structure:

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

The `sync_committee_bits` indicate which members voted (not all need to vote), and the `sync_committee_signature` is a BLS signature of the members referenced in the bit vector.

BLS signatures (Boneh-Lynn-Shacham) are a type of cryptographic signature scheme that allows multiple signatures to be aggregated into a single signature. This makes them space and compute efficient (you can aggregate hundreds of signatures into one). Just as we aggregate signatures, we can aggregate public keys as well, such that the aggregate public key can verify the aggregated signature.

For our SyncAggregate, computing the aggregate pubkey is simple:

```python
{{ #shiftinclude  auto:../snippets/bls_aggregate.py }}
```

At scale, we can aggregate thousands (if not hundreds of thousands) of signatures and public keys, while only verifying their aggregates.

To our light client, as long as a majority of sync committee members have attested the block, it is considered final.

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
```

Now we have the `aggregate_pubkey` for the committee, as well as verifying that enough members have signed. Notice that to obtain the sync committee public keys, we used `self.current_sync_committee`. This is set during initialization, and later updated in our `update` function.

Next we have to construct the digest (what has been signed) before we verify the aggregated signature. If we didn't compute the digest ourselves, but obtained it from the block, then the caller could fraudulently pass a correct digest, but have other values in the block altered.

```python
    signing_root = self._compute_signing_root(block)

    # Verify the aggregated signature against the aggregated public key
    if not bls.Verify(
        aggregate_pubkey,
        signing_root,
        sync_aggregate.sync_committee_signature
    ):
        raise ValueError("Invalid sync committee signature")
```

Since the signature and block are both valid, we can now trust the contents of the passed beacon block. Next the light client will store data from the block:

```python
    self.latest_block_root = self._compute_block_root(block)
    self.latest_slot = block.slot
```

Finally, we have to update the sync committee. The committee rotates every sync committee period (256 epochs), and thus if this is at the boundary, we have to update these values. Luckily Ethereum makes this easy for us, and provides what the next sync committee will be:

```python
    if slot % (SLOTS_PER_EPOCH * EPOCHS_PER_SYNC_COMMITTEE_PERIOD) == 0:
        self.current_sync_committee = self.next_sync_committee
        self.next_sync_committee = block.next_sync_committee
```

`SLOTS_PER_EPOCH` and `EPOCHS_PER_SYNC_COMMITTEE_PERIOD` can be hardcoded, or stored in the light client state. Each epoch is 32 slots (approximately 6.4 minutes), so a full sync committee period lasts about 27.3 hours.

With this relatively simple protocol, we now have a (python) smart contract that can track Ethereum's blocks.

### Optimizations

In actuality, the beacon block is still too large for a light client. The actual light client uses the [`LightClientHeader`](https://github.com/unionlabs/union/blob/cfe862e6dacf5474925110504891fa4120e747f6/lib/beacon-api-types/src/deneb/light_client_header.rs#L16C12-L16C29) data structure, which consists of a beacon header and execution header.

The beacon header is used to prove the consensus and transition the internal state, as well as immediately prove that the execution header is valid. The block height in the execution header is then used for further client operations, such as transaction timeouts. Using the execution height instead of the beacon height for timeouts has advantages for users and developers, ensuring they do not even need to be aware of the Beacon Chain's existence.

Another significant optimization relates to signature aggregation. Since the majority of the sync committee always signs, we instead aggregate the public keys of the non-signers, and subtract that from the aggregated total. Effectively, if on average 90% of members sign, we submit the 10% that did not sign. This results in an approximate 80% computational reduction (by avoiding the need to process 90% of the signatures individually), as well as reducing the size of the client update transaction.
