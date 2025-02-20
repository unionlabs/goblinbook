# Getting Started

Developing interoperability technology—or working across multiple chains simultaneously—requires a complex local development setup. You'll often need to run various chains and off-chain services concurrently. Consider a simple application that aggregates traffic from Ethereum, Solana, and Hyperliquid. Such an application would need to operate:

### Development Environments:

- Ethereum devnet
- Arbitrum devnet (required for Hyperliquid settlement)
- Solana devnet
- Hyperliquid devnet

### Services:

- Relayer
- Indexer
- Database
- Frontend

### Programming Languages and Tools:

- Solidity (via solc)
- Rust
- Golang
- Typescript
- Docker

This list continues to grow as projects become more sophisticated.
Managing tool versions across different developers becomes a significant challenge. Currently, there are two main approaches for handling complex setups like this: Bazel and Nix. Throughout this book, we'll use Nix—our Goblin-approved solution—to manage these development environments efficiently.
