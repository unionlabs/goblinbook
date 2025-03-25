# ZK

In the previous chapter, we learned how a simple light client operates. In this chapter, we will look into leveraging zero-knowledge cryptography to improve the onchain efficiency of our light client.

Recall how a light client verifies that a block is canonical. In the case of Ethereum, we track the sync committee and aggregate the BLS public key. The signature already comes pre-aggregated in the block.

```python
{{ #shiftinclude  auto:../snippets/bls_aggregate.py }}
```

For other chains, pre-aggregation might not occur. For example, Tendermint simply has each validator signature (and vote) appended in the block. This means that to verify if the block is canonical, we have to perform a signature verification for each validator individually. Here is a pseudo-Python Tendermint block verifier (it doesn't handle voting correctly and misses some components).

```python
{{ #shiftinclude  auto:../snippets/verify_tendermint_votes.py }}
```

Note how for each vote, we perform:

```python
{{ #shiftinclude  auto:../snippets/verify_tendermint_votes.py:verify-signature }}
```

Although this is just a single verify operation, computationally it is quite expensive. Doing this in Solidity would mean that we would spend about ±2 million gas per block verification. This also means that with more validators operational, we have a linear increase in computational cost. This cost translates into a higher fee for end users, making it something we want to avoid.

We can leverage zero-knowledge cryptography to have a constant computational cost, irrespective of the number of signatures we verify, as well as perform arbitrary other computation, such as vote-weight tallying.

First we will explore how to leverage [Gnark](https://github.com/Consensys/gnark) to build a high performance circuit, analyzing an actual production circuit. Next we will re-implement the same logic using a [zkvm](https://dev.risczero.com/api/zkvm/).
