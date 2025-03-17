# Chain IDs

Most blockchains use a unique identifier (like Ethereum's `1`) to protect users against replay attacks and help wallets select the correct chain. Applications typically assume these IDs are globally unique across both mainnet and testnets. For example, Sepolia uses `11155111`, while Ethereum mainnet uses `1`.

Initially, Union also used these 'canonical' identifiers, but this approach revealed a critical issue: chain IDs aren't actually unique across different blockchain ecosystems. For instance, Aptos also uses ID `1`, creating potential security vulnerabilities like replay attacks, especially for EVM-compatible Move-based chains.

To address this problem, Union implemented a more robust format:

```
{ hrp }.{ chainId }
```

In this structure, `chainId` represents how a chain identifies itself, while `hrp` (human-readable part) provides a recognizable prefix. For example, Union's testnet is identified as `union.union-testnet-10`.

This approach ensures true uniqueness across blockchain ecosystems while maintaining compatibility with existing systems.