# Clients

Clients are modules that track and verify the state of other chains. How they do this varies significantly based on the execution environment of the connected chains. Most clients are implemented as smart contracts.

## Core Concepts

Every IBC client must provide:

1. State tracking of the counterparty chain
1. Verification of state updates
1. Proof verification for individual transactions/packets
1. Misbehavior detection

However, the implementation details can vary depending on the execution environment (EVM or Move for example).

We usually refer to both the code and to the instatiation as a client. The best way to grok this, is to see a client
as both the ERC20 code implementation, and an actual ERC20 coin. There can be many clients on a chain, and new clients can be trustlessly instatiated after the code has been uploaded.

### State Tracking

Clients must maintain a view of their counterparty chain's state. This typically includes:

- Latest verified header/block height
- Consensus state (if applicable)
- Client-specific parameters like timeout periods
- Commitment roots for verifying packet data

Much like how an ERC20 contract tracks balances, a client tracks these state components for its specific counterparty chain instance. The client logic defines what state to track, while each client instance maintains its own state values.

### Verification

Verification is how clients validate state updates from their counterparty chain. This process varies dramatically based on the chain's architecture:

- Tendermint chains verify through validator signatures
- Ethereum clients check PoW/PoS consensus rules
- L2s might verify through their parent chain's mechanisms

The client code implements the verification rules, while each instance enforces these rules on its specific counterparty chain's updates.

### Inclusion Proofs

Clients must verify proofs that specific transactions or packets were included in the counterparty chain's state. This involves:

1. Verifying the proof format matches the counterparty's tree structure
1. Checking the proof against the stored commitment root
1. Validating the claimed data matches the proof

For example:

- Tendermint chains use IAVL+ tree proofs
- Ethereum uses Merkle Patricia proofs
- Some L2s use their own specialized proof formats

### Misbehavior Detection

Clients implement rules to detect and handle misbehavior from their counterparty chains. Common types include:

1. **Double signing** - Same height with different state roots
1. **Invalid state transitions** - Consensus rule violations
1. **Timeout violations** - Not responding within parameters

When misbehavior is detected, clients can:

- Freeze to prevent further packet processing
- Allow governance intervention
- Implement automatic resolution mechanisms

Just as each ERC20 instance can be frozen independently, each client instance handles misbehavior for its specific counterparty chain relationship.

## Implementations

Clients are the most complex portion of how IBC works. Implementations depend on deep cryptographic and algorithmic knowledge of consensus verification. Later we will describe how to implement one, but for now it is better to understand the protocol in full.

We can query for current live clients by running:

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Command')">Fetch Clients</button>
  <button class="tablinks" onclick="openTab(event, 'Nix')">Nix</button>
</div>

<div id="Command" class="tabcontent">

```bash
gq https://graphql.union.build/v1/graphql -q '
{
  v1_ibc_union_clients(limit: 3) {
    client_id
    chain {
      display_name
    }
    counterparty_chain {
      display_name
    }
  }
}'
```

</div>

<div id="Nix" class="tabcontent">

```bash
nix shell nixpkgs#nodePackages.graphqurl
```

</div>

This provides information for which client is live on which chain, and what other chain it is tracking.
