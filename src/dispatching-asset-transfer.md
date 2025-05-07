# Dispatching an Asset Transfer

Let's dive into interoperability by performing a complex cross-chain operation programmatically. While this interoperability touches upon several technical concepts like asset standards, altVMs, indexing, light clients, and storage proofs, our main goal is to execute an end-to-end operation and understand the components involved. We'll explore the theoretical foundations in later chapters.

We will implement a TypeScript program that can manage EVM (Ethereum Virtual Machine) wallets, interact with multiple chains, and dispatch asset transfers through smart contract interactions. Finally, we will query an indexing service to trace our transfer's progress. While this code works in both frontend and backend environments thanks to TypeScript, we recommend Rust for production backends.

## Setting up the project

```console
mkdir asset-dispatcher
```

Create a `flake.nix` with the following configuration. This sets up [Deno](https://deno.com/) for your local development environment and adds code formatters (run with `nix fmt`). Enable the development environment by running `nix develop`.

```nix
{{ #shiftinclude  auto:../projects/asset-dispatcher/flake.nix }}
```

Next, create `src/index.ts`. This will contain most of our logic. Add a simple test:

```typescript
console.log("hello, world");
```

Run it with `deno run src/index.ts` to verify your environment works. You should see `hello, world` in your terminal.

## Managing wallets

Let's modify `index.ts` to create and fund two wallets. Note: This example hardcodes mnemonics for demonstration purposes. In production, always use proper key management services.

```typescript
{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:managing-wallets-imports }}

{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:managing-wallets }}
```

Create two variables, `mnemonic1` and `mnemonic2`, each containing a 12-word sentence (space-separated) as a string. Run the script and save your addresses. You can use the same mnemonic if you prefer.

To fund our Sepolia address for contract interactions, we'll use a [faucet](https://www.alchemy.com/faucets/ethereum-sepolia).

Let's verify our faucet funding by checking the balance:
create-client

```typescript
{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:create-client-imports }}

{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:create-client }}
```

We use `formatEther` for human-readable output. The parenthesized value shows the raw balance. We'll discuss sats, decimals, and asset standards later, but note that ETH is stored in wei on-chain (1 ETH = 10^18 wei).

At this point, we have secured testnet funds and set up a local wallet (though not production-ready).

## Performing the Asset Transfer

To do the bridge operation, we'll directly interact with the Union contracts through their ABI. We will use the Union [SDK](https://www.npmjs.com/package/@unionlabs/sdk) package to import some types and the required ABIs. The sdk provides both low-level bindings to various contracts, as well as backend clients and effects based on [effect.website](https://effect.website/).

For now we are going to use the raw bindings, to show what happens under the hood. To perform an asset transfer, we need to perform 3 distinct steps:

1. Gather configuration parameters.
1. Approve the contracts.
1. Sending the bridge transfer.

For step 1. we will rely on etherscan and the Union API. In production you might want to store hardcoded mappings, or dynamically fetch these values from your own APIs. Constructing the transaction is simple for an asset transfer. This is also the stage where we might add 1-click swaps, or DEX integration later down the road.

Although step 3 seems trivial, it is actually quite annoying when dealing with multiple, independent ecosystems. That's why we are doing EVM to EVM for now, so we are only dealing with one execution environment implementation.

### Configuration Parameters

Since Union leverages channels, we will need to query the channel-id to use between Sepolia and Holesky. We're using the `ucs03-zkgm-0` protocol, so that's what we'll filter on. The `v2_channel_recommendations` shows officially supported channels by the Union team.

```graphql
{{ #shiftinclude auto:./queries/channel-recommendations-zkgm.graphql }}
```

For our transfer, we are interested in the `source_channel_id` for Sepolia (`ethereum.11155111`).

Since we are doing a WETH transfer, we can use [etherscan](https://sepolia.etherscan.io/token/0x7b79995e5f793a07bc00c21412e50ecae098e7f9#readContract) to find the asset parameters (symbol, decimals and name). Union does verify onchain that the provided parameters are correct. We do pass them to the contract because we want to calculate the packet hash ahead of time. You might wonder why we even use these values in the contract? That is to ensure that when Union instantiates a new asset on the destination chain, it is configured correctly (same symbol, decimals, and name).

Per chain, we can find the Union contracts [here](https://github.com/unionlabs/union/blob/97e5e8346f824e482185953a6648ad8b9bed9ac3/deployments/deployments.json#L256). For testnet deployments, these might be updated as of writing this book.

Finally we need to obtain the quote token address (the address of the asset on the destination side).

```graphql
{{ #shiftinclude auto:./queries/get-transfer-request-details.graphql }}
```

This should return

```
{
  "data": {
    "get_wrapped_transfer_request_details": [
      {
        "quote_token": "0x685a6d912eced4bdd441e58f7c84732ceccbd1e4",
        "source_channel_id": 8,
        "destination_channel_id": 47,
        "already_exists": true
      }
    ]
  }
}
```

The `source_channel_id` should match the channel from the `v2_channel_recommendations` query.

The `quote_token` is deterministically generated depending on the contract addresses and channel_ids. If `already_exists` is false, the Union contract on the destination chain will instantiate a new asset, hence why the deterministically derived address algorithm is so important.

## Approvals

Under the hood, the Union contract will withdraw funds from our account before bridging them to Holesky. This withdrawal is normally not allowed (for security reasons, imagine if smart contracts were allowed to just remove user funds!), so we need to `approve` the Union contract to allow it to withdraw.

```typescript
{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:approvals-imports }}

{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:approvals }}
```

For convenience, we are allowing the contract `MaxUint256`, so that we do not need to do further approvals. From now on, the Union ucs03 contract can withdraw WETH on Sepolia.

## Bridging

Executing the actual bridge operation seems like quite a lot of lines of code. Later we will use the alternative typescript client and effects API, to simplify the flow.

When we interact with the `send` entrypoint, we submit a program. Union's bridge standard leverages a lightweight, non-Turing complete VM. That way, we can do 1-click swaps, forwards, or other arbitrary logic. The `args` for our call in this case is the `Batch` instruction, which is effectively a list of instructions to execute. Inside the batch, we have two `FungibleAssetOrder`s. The first order is transferring wrapped Eth using a 1:1 ratio (meaning that on the receiving side, the user will receive 100% of the amount). The second order has a 1:0 ratio, meaning that the user receives nothing on the destination side. Effectively, we are 'tipping' the protocol here. An alternative way to ensure this transfer is funded, is altering the ratio of the first transfer. For example, a 100:99 ratio would be a 1% transfer fee.

```typescript
{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:send-imports }}

{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:send }}
```

The denomAddress is the ERC20 address of the asset we want to send. You might notice that regular ETH does not have an address, because it is not an ERC20. To perform the transfer, ETH must be wrapped to WETH (optional if you already own WETH):

```typescript
{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:wrapping-imports }}

{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:wrapping }}
```

Once this transaction is included, the transfer is enqueued and will be picked up by a solver. Next we should monitor the transfer progression using an indexer. The easiest solution is \[graphql.union.build\], which is powered by \[`hubble`\]. Later we will endeavour to obtain the data directly from public RPCs as well.

## Tracking Transfer Progression

Once the transfer is enqueued onchain, we go through a pipeline of backend operations, which normally are opaque to the enduser, but useful for us for debugging (and fun to look at). Union refers to these steps as `Traces`, and they are indexed and stored for us by Hubble. Some of these include:

- `PACKET_SEND`
- `PACKET_SEND_LC_UPDATE_L0`
- `PACKET_RECV`
- `PACKET_ACK`

The `PACKET_SEND` was actually us performing the transfer. The other steps are executed by solvers. Later we will write a solver to explore what each entails.

To get the tracing data, we'll make a [Graphql](https://graphql.org/) query. For now we will just use `fetch` calls, but there are many high quality graphql clients around.

```typescript
{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:query-traces | dedent }}
```

For example, for the transaction hash `0xa7389117b99b7de4dcd71dc2acbe21d42826dd4d35174c72f23c0adb64144863`, we get the following data:

```json
{
  "data": {
    "v2_transfers": [
      {
        "traces": [
          {
            "type": "PACKET_SEND",
            "height": 7839514,
            "chain": {
              "display_name": "Sepolia",
              "universal_chain_id": "11155111.sepolia"
            }
          },
          {
            "type": "PACKET_SEND_LC_UPDATE_L0",
            "height": null,
            "chain": {
              "display_name": "Union Testnet 9",
              "universal_chain_id": "union-testnet-9.union"
            }
          },
          {
            "type": "PACKET_RECV",
            "height": null,
            "chain": {
              "display_name": "Union Testnet 9",
              "universal_chain_id": "union-testnet-9.union"
            }
          },
          {
            "type": "WRITE_ACK",
            "height": null,
            "chain": {
              "display_name": "Union Testnet 9",
              "universal_chain_id": "union-testnet-9.union"
            }
          },
          {
            "type": "WRITE_ACK_LC_UPDATE_L0",
            "height": null,
            "chain": {
              "display_name": "Sepolia",
              "universal_chain_id": "11155111.sepolia"
            }
          },
          {
            "type": "PACKET_ACK",
            "height": null,
            "chain": {
              "display_name": "Sepolia",
              "universal_chain_id": "11155111.sepolia"
            }
          }
        ]
      }
    ]
  }
}
```

Universal chain IDs are chain identifiers specifically used by Union, which are, as the name implies, universally unique. The reason for deviating from what the chains themselves use, is described [here](./union/chain-ids.md).

If we want to monitor the progression of a transfer, we would poll this query. There are three important trace types to watch for.

- `PACKET_SEND`: our transaction was included on the source chain. From this moment on, explorer links using the transaction hash should return data. (on average, the Union API is about 5-10 seconds faster than Etherscan though.)
- `PACKET_RECV`: the relayer has submitted a proof and the packet for the transfer. Funds are now usable on the destination side. The transfer flow is now 'completed' from the user's perspective.
- `PACKET_ACK`: the relayer has acknowledged the transfer on the source chain. If the open-filling API was used, this event will also trigger payment for the solver. This is only of interest for solvers/backend engineers.

Once we see the `PACKET_RECV` event, our funds will be usable on Holesky. The traces after that are used by the system to pay the solver, and maintain bookkeeping.

We can query Holesky for our balance to verify that we received funds:

```typescript
{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:verify-balance-imports }}

{{ #shiftinclude  auto:../projects/asset-dispatcher/src/index.ts:verify-balance }}
```

This should now return the amount sent in the first `FungibleAssetOrder`.

## Summary

This was a hands-on way to introduce you to multichain programming. We have omitted the implementation details of many of the individual steps. You have now experienced the transfer flow that a regular user experiences when interacting through UIs. In the next chapter, we will go deeper into what each trace meant. Later we will write a simple solver, and show orders are filled.
