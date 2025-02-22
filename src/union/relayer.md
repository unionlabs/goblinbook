# Union Relayer

The Union IBC relayer is the infrastructure component that performs the I/O and transaction submissions. Think of it as a blockchain postal service - monitoring, packaging, and delivering messages between chains. It connects to various RPCs to detect new blocks and users interacting with IBC contracts, to then generate proofs and submit transactions to destination chains.

## How Messages Flow

Let's walk through the process of how a message moves between chains using the relayer:

1. A user submits a message on Chain A
1. Chain A stores the message and emits an event
1. The relayer detects this event
1. The relayer queries Chain A to generate a consensus proof
1. The relayer submits the proof and message to Chain B
1. Chain B verifies and executes the message
1. The relayer queries Chain B to generate a consensus proof
1. The relayer confirms receipt back to Chain A using 7.

Depending on the packets being relayed, the relayer may earn a fee. `ICS20` allows for 'tipping' the relayer, while Union chooses a UTXO style model, which means that the relayer earns the leftover assets after a transfer occurs. Frontends usually display this as a fee to the user, but under the hood they construct a `Batch` of `FungibleAssetOrder`s where the quote side will be zero, effectively tipping the relayer.

## Core Functions

### Chain Monitoring

The relayer maintains active connections to multiple blockchain networks simultaneously. For each chain, it:

- Subscribes to new blocks and events
- Tracks block confirmations
- Monitors chain health and consensus status
- Connects to a prover service

Chain monitoring must be highly reliable as missed events could lead to stuck packets. The relayer implements sophisticated retry and recovery mechanisms.

### Proof Generation and Verification

For each supported chain pair, the relayer leverages a proving service to generate the actual proofs. It collects the public and private inputs before making the API call.

The reason relaying and proving is separated out over this interface, is because relaying is an I/O heavy operation, that requires fast internet access, while proving is a compute heavy operation. Proving can also be distributed over various machines, which the API abstracts over. That way, the relayer does not need to know the proving implementation.

## Implementations

There are three major IBC relayer implementations:

- [Hermes](https://github.com/informalsystems/hermes)
- [Go Relayer](https://github.com/cosmos/relayer)
- [Voyager](https://github.com/unionlabs/union/tree/main/voyager)

We will discuss Voyager's architecture in this book, as it is the most flexible to extensions and supports the widest array of implementations.

### Architecture

Voyager leverages a stateless, message based architecture. Internally it leverages \[PostgresSQL\] to maintain a queue of events, and tasks to execute. Each RPC call to fetch data, transaction to be submitted, timer or error encountered is represented by a JSON stored in the database.

#### Plugins

Voyager leverages various plugins to submit transactions, handle new types of chains, and inspect the intermediate state of packets for filtering or modification.
