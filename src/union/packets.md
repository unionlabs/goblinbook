# Packets

Packets are the unit of cross-chain communication that carry application data through established channels. For unordered channels, packets can be delivered in any sequence, making them ideal for applications where message ordering isn't critical. Union specifically chose not to support ordered channels due to their poor performance during congestion and incompatibility with fee markets.

```mermaid
sequenceDiagram
    participant App A
    participant Chain A
    participant Chain B
    participant App B

    App A->>Chain A: Send Packet
    Note over Chain A: Store Commitment
    Chain A-->>Chain B: Relay Packet + Proof
    Note over Chain B: Verify Proof
    Chain B->>App B: Execute Packet
    Note over Chain B: Store Receipt
    Chain B-->>Chain A: Acknowledge + Proof
    Note over Chain A: Mark Commitment
```

Each packet contains:

- Source channel
- Destination channel
- Timeout height or timestamp
- Data payload

Packet Lifecycle:

1. Application sends data through its channel
1. Source chain stores a commitment to the packet
1. Relayer delivers packet and proof to destination
1. Destination verifies and executes packet
1. Relayer returns acknowledgment to source
1. Source chain cleans up the commitment

Timeouts prevent packets from being permanently stuck if the destination chain halts or refuses to process them. When a timeout occurs, the source chain reclaims the packet and notifies the sending application.

## ucs01-zkgm

Union leverages a specialized channel with packet data for asset transfers. While analogous to ics01 in legacy IBC chains, it offers several advantages:

- Multi-Asset transfers
- Open Filling
- Ahead of Finality (AoF) filling
- Routing for GMP

The packet schema functions as a small program with various instructions executed by the IBC app:

```solidity
struct ZkgmPacket {
    bytes32 salt;
    uint256 path;
    Instruction instruction;
}

struct Instruction {
    uint8 version;
    uint8 opcode;
    bytes operand;
}
```

Instructions use ethabi encoding to structure packets or perform operations. For example, the `Forward` instruction enables packet forwarding:

```solidity
struct Forward {
    uint32 channelId;
    uint64 timeoutHeight;
    uint64 timeoutTimestamp;
    Instruction instruction;
}
```

The most common instruction is `FungibleAssetOrder`:

```solidity
struct FungibleAssetOrder {
    bytes sender;
    bytes receiver;
    bytes baseToken;
    uint256 baseAmount;
    string baseTokenSymbol;
    string baseTokenName;
    uint256 baseTokenPath;
    bytes quoteToken;
    uint256 quoteAmount;
}
```

This instruction powers the official Union app's bridging functionality. Unlike other bridges, it includes both base and quote information, enabling users to specify desired asset conversions (e.g., USDC to unionUSDC). This design allows `FungibleAssetOrder` to handle non-equivalent asset swaps when solvers provide liquidity.

We can see this structure inside the packets live:

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Command')">Command</button>
  <button class="tablinks" onclick="openTab(event, 'Nix')">Nix</button>
</div>

<div id="Command" class="tabcontent">

```bash
gq https://development.graphql.union.build/v1/graphql -q '
{{ #shiftinclude auto:../queries/packets.graphql }}'
```

</div>

<div id="Nix" class="tabcontent">

```bash
nix shell nixpkgs#nodePackages.graphqurl
```

</div>

The indexer uses the `channel.version` to decode the packet and show what is being transmitted. For `ucs03-zkgm-0`, you should observe something like

```
{
  "data": {
    "v2_packets": [
      {
        "channel_version": "ucs03-zkgm-0",
        "decoded": {
          "path": "0x0",
          "salt": "0x39cdaec1be16a7f3a5c39db77ff337ba8675c8937e81b0d2418b1b52f404e4d4",
          "instruction": {
            "_index": "",
            "opcode": 2,
            "operand": {
              "_type": "Batch",
              "instructions": [
                {
                  "_index": "0",
                  "opcode": 3,
                  "operand": {
                    "_type": "FungibleAssetOrder",
                    "sender": "0x307865663433356538653663353337363130666562636361656538356236363864623165636166653032",
                    "receiver": "0x50a22f95bcb21e7bfb63c7a8544ac0683dcea302",
                    "baseToken": "0x7562626e",
                    "baseAmount": "0x1",
                    "quoteToken": "0x9e8af87a38012f5bb809b8040b4e34439fb8122f",
                    "quoteAmount": "0x1",
                    "baseTokenName": "ubbn",
                    "baseTokenPath": "0x0",
                    "baseTokenSymbol": "ubbn",
                    "baseTokenDecimals": 0
                  },
                  "version": 1,
                  "_instruction_hash": "0x6d4debb95009b4c114d1faeac846042755da1e4814d92d300004c091d30581ae"
                }
              ]
            },
            "version": 0,
            "_instruction_hash": "0x44e9064c6fbb9ee05a91dc52a4fe66f0b6544bd5a7f747f445e3610e9bc910bc"
          }
        }
      },
      ...
  ]}
}
```

Here we can see a packet with a `FungibleAssetOrder`, so we know this is funds being transmitted from one chain to another.

### Fees

Rather than explicitly defining relayer and gas fees, `FungibleAssetOrder` incentivizes packet processing through the value difference between baseAmount and quoteAmount for equivalent assets:

```solidity
FungibleAssetOrder({
    ...
    baseToken: USDC,
    baseAmount: 100,
    quoteToken: USDC,
    quoteAmount: 99,
})
```

This example sets a 1 USDC fee independent of the destination chain's gas token. Relayers evaluate packet settlement based on profitability.

### Gas Station

The protocol addresses the common challenge of users lacking gas tokens after bridging through a composable instruction system. While some centralized bridges offer unreliable gas services, Union's approach uses the `Batch` instruction to combine multiple `FungibleAssetOrder` instructions atomically:

```solidity
struct Batch {
    Instruction[] instructions;
}
```

A transfer with gas deposit combines two orders:

```solidity
Batch({
    instructions: [
        FungibleAssetOrder { actualTransferDetails.. },
        FungibleAssetOrder { baseTokenAmount: 0, quoteToken: $GAS, quoteTokenAmount: 1 },
    ],
})
```

Relayers evaluate the batch's cumulative profit, converting gas tokens to USD value. For instance, if the first order yields 5 USD profit and the second costs 1 $GAS, relayers fulfill the packet when the net profit exceeds their threshold. The smart contract uses the relayer's balance for the gas portion, demonstrating open filling functionality.

### Marking Commitments

Union's approach to handling commitments differs from traditional IBC implementations in an important security aspect. While IBC-classic allows commitments to be cleaned up due to unique sequencing, Union's optimistic packet execution model requires a different approach to prevent potential exploits.

#### The Security Challenge

A key security vulnerability could arise if commitments were cleaned (deleted) rather than marked:

1. An attacker could send a packet
1. Get it acknowledged
1. Exploit the commitment cleanup to loop this sequence:
   - Send the same packet again (generating same hash)
   - Get acknowledgment
   - Repeat

This attack vector exists because packet hashes can collide when identical packets are sent multiple times, unlike IBC-classic where sequence numbers ensure uniqueness.

#### Solution: Marking Instead of Cleaning

To prevent this attack while maintaining optimistic execution, Union:

1. Keeps all commitments stored instead of cleaning them
1. Marks fulfilled commitments as "acked" rather than deleting them
1. Validates against this "acked" status to prevent replay attacks

This approach:

- Prevents the looping vulnerability
- Only costs about 4k more gas compared to cleaning
- Maintains security without compromising the optimistic execution model

The gas cost difference is negligible compared to the protocol level advantage that optimistic solving provides.
