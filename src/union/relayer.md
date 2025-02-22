# Union Relayer

The Union IBC relayer is the infrastructure component that performs the I/O and transaction submissions. Think of it as a blockchain postal service - monitoring, packaging, and delivering messages between chains. It connects to various RPCs to detect new blocks and users interacting with IBC contracts, to then generate proofs and submit transactions to destination chains.

## How Messages Flow

Let's walk through the process of how a message moves between chains using the relayer:

1. A user submits a message on Chain A
2. Chain A stores the message and emits an event
3. The relayer detects this event
4. The relayer queries Chain A to generate a consensus proof
5. The relayer submits the proof and message to Chain B
6. Chain B verifies and executes the message
7. The relayer queries Chain B to generate a consensus proof
8. The relayer confirms receipt back to Chain A using 7.

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