# Light Client Circuit

Before reading this section, make sure that you are familiar with [Gnark](./gnark.md). In this chapter, we will analyze a light client circuit, verifying a modified Tendermint consensus (CometBLS).

At the heart of our light client is a data structure representing validators and their signatures:

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:core-data}}
```

Each validator is represented by its public key coordinates (stored in a special format to work within field size limitations) and voting power. The TendermintLightClientInput combines these validators with signature data and metadata such as the number of validators and a bitmap indicating which validators have signed. This is the equivalent of our [`LightClientHeader`](https://github.com/unionlabs/union/blob/cfe862e6dacf5474925110504891fa4120e747f6/lib/beacon-api-types/src/deneb/light_client_header.rs#L16C12-L16C29) as seen in the [light client](../light-clients/ethereum.md) chapter.

The circuit uses several helper functions to efficiently manipulate large field elements:

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:unpack}}

{{ #shiftinclude  auto:../snippets/lightclient.go:repack}}
```

The Unpack function splits a variable into smaller components, while Repack does the opposite. These functions are needed when working with cryptographic values that exceed the size of the prime field.

The core logic of the light client is in the `Verify` method:

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:verify-signature}}
```

This function verifies that:

1. The validator set matches a known root hash
1. A sufficient number of validators (by voting power) have signed
1. The signature is cryptographically valid

Let's break down the steps in the verification process:

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:preliminary-checks}}
```

These constraints ensure basic properties: the number of validators doesn't exceed the maximum, the number of signatures doesn't exceed the number of validators, and there's at least one signature. Next the circuit defines a helper closure with logic to be executed for each validator.

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:for-each-val-signature}}
...
```

Note that the function accepts another closure, which it will call after reconstructing some values and adding constraints.

Inside this function, for each validator, we:

Compute a hash of the validator's data (similar to a Merkle leaf)

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:for-each-val-hash}}
```

Reconstruct the full public key by combining its components

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:for-each-val-reconstruct-pubkey}}
```

Determine if this validator has signed by checking the bitmap

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:for-each-val-bitmask}}
```

Apply the provided function to process this validator. This is where we pass an additional closure to calculate aggregated values over the entire validator set. This is a pattern often used in functional programming.

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:for-each-val-collect}}
```

The aggregated values of interest are:

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:aggregated-values}}
```

We sum the voting power, since we do not want to verify that 2/3 validators attested the block, but that 2/3 of the voting power attested to it. In Tendermint based chains, validators can have a variable amount of stake, as opposed to Ethereum, where it is always 32 ETH.

Finally we verify the aggregated values.

```go
{{ #shiftinclude  auto:../snippets/lightclient.go:final-constraints}}
```

These verify that:

- The claimed number of signatures matches the actual count.
- The voting power of signers exceeds the required threshold (expressed as a fraction).
- The validator set matches a known Merkle root.

Much like our Sudoku example, this circuit defines a relationship between public inputs (the expected validator root, message, and signature) and private witness data (the validator set details). When we generate a proof, we're demonstrating knowledge of a valid validator set that signed the message, without revealing the validator details.

This chapter does not cover some of the cryptographic primitives that had to be implemented to perform hashing or BLS aggregation and verification. Those can be found [here](https://github.com/unionlabs/union/tree/fe2498939498535437a5de82c32fa994ec38b7c7/galoisd/pkg).

Next we will explore the trusted setup ceremony, an alternative to doing an unsafe setup. All custom circuits that produce SNARKs require one.
