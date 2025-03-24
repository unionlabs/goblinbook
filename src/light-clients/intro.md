# Light Clients

Trust-minimized interoperability protocols use light clients to secure message passing between blockchains. Light clients can be implemented as smart contracts, Cosmos SDK modules, or components within wallets. Their fundamental purpose is to verify the canonicity of new blocks—confirming that a block is a valid addition to a blockchain—without requiring the full block data.

### Block Structure Fundamentals

A blockchain block typically consists of two main sections:

**Header**: Contains metadata about the block, including:

- Block producer information
- Block height and timestamp
- Previous block hash
- State root (a cryptographic summary of the blockchain's state)
- Transaction root (a Merkle root of all transactions in the block)
- Other consensus-specific data

**Body**: Contains the complete list of transactions included in the block.

The header has a fixed size (typically a few hundred bytes), while the body's size varies dramatically based on the number and complexity of transactions. This size difference is crucial for understanding light client efficiency.

The key distinction between light clients and full nodes lies in their data requirements:

- **Light clients** only process block headers, which enables efficient verification with minimal data (kilobytes instead of megabytes or gigabytes)
- **Full nodes** process both headers and bodies, requiring significantly more computational resources and storage

This efficiency makes light clients ideal for cross-chain communication, mobile applications, and resource-constrained environments.

Light clients achieve security through cryptographic verification rather than data replication. They:

1. Track validator sets from the source blockchain
1. Verify consensus signatures on new block headers
1. Validate state transitions through cryptographic proofs
1. Maintain only the minimal state required for validation

This approach ensures that even with minimal data, light clients can detect invalid or malicious blocks.

Light clients form the backbone of trustless bridge infrastructure:

- Smart contract-based light clients on Ethereum can verify Cosmos chain blocks
- Cosmos modules can verify Ethereum blocks using embedded light clients
- Cross-rollup communication can leverage light client technology for L2-to-L2 messaging

When implemented as bridge components, light clients enable secure cross-chain asset transfers and message passing without requiring trusted third parties.

### Wallets and User Interfaces

Modern wallet implementations increasingly incorporate light client technology:

- Mobile wallets can verify transactions without syncing the entire chain
- Browser extensions can validate state without backend reliance
- Hardware wallets can verify complex operations with limited resources

This improves both security and user experience by reducing dependency on remote (RPC) servers.

### Ethereum Light Client Deep Dive

Ethereum's light client protocol is particularly significant for Union's architecture. It uses a combination of:

1. **Consensus verification**: Validating signatures from the beacon chain's validator set
1. **Sync committees**: Tracking rotating sets of validators for efficient verification
1. **Merkle proofs**: Verifying transaction inclusion and state values without downloading the full state

Ethereum light clients can securely validate blocks with just a few kilobytes of data, compared to the hundreds of megabytes required for full validation. This efficiency makes them ideal for cross-chain applications.

In subsequent sections, we'll examine how Union leverages these light client principles to secure cross-chain communication and explore implementation details of the Ethereum light client that secures a significant portion of Union's traffic.
