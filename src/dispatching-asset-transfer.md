Here's an edited version that improves clarity and fixes some technical details:

# Dispatching an Asset Transfer

Let's dive into interoperability by performing a complex cross-chain operation programmatically. While this chapter touches upon several technical concepts like asset standards, altVMs, indexing, light clients, and storage proofs, our main goal is to execute an end-to-end operation and understand the components involved. We'll explore the theoretical foundations in later chapters.

We will implement a TypeScript package that can manage EVM (Ethereum Virtual Machine) wallets, interact with multiple chains, and dispatch asset transfers through smart contract interactions. Finally, we will query an indexing service to trace our transfer's progress. While this code works in both frontend and backend environments thanks to TypeScript, we recommend Rust for production backends.

## Setting up the project

```console
mkdir asset-dispatcher
```

Create a `flake.nix` with the following configuration. This sets up [Deno](https://deno.com/) for your local development environment and adds code formatters (run with `nix fmt`). Enable the development environment by running `nix develop`.

```nix
{
  description = "CLI for Asset Dispatching";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt.url = "github:numtide/treefmt-nix";
  };
  outputs =
    inputs@{
      self,
      nixpkgs,
      flake-parts,
      treefmt,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        treefmt.flakeModule
      ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      perSystem =
        {
          config,
          self',
          inputs',
          pkgs,
          system,
          ...
        }:
        {
          devShells = {
            default = pkgs.mkShell {
              buildInputs =
                [
                  pkgs.deno
                  pkgs.supabase-cli
                ]
                ++ (pkgs.lib.optionals pkgs.stdenv.isDarwin (with pkgs.darwin.apple_sdk.frameworks; [ Security ]));
            };
          };
          treefmt = {
            projectRootFile = "flake.nix";
            programs.nixfmt.enable = pkgs.lib.meta.availableOn pkgs.stdenv.buildPlatform pkgs.nixfmt-rfc-style.compiler;
            programs.nixfmt.package = pkgs.nixfmt-rfc-style;
            programs.deno.enable = true;
            programs.mdformat.enable = true;
          };
        };
    };
  nixConfig = {
    extra-substituters = [
      "https://union.cachix.org/"
      "https://cache.garnix.io"
    ];
    extra-trusted-public-keys = [
      "union.cachix.org-1:TV9o8jexzNVbM1VNBOq9fu8NK+hL6ZhOyOh0quATy+M="
      "cache.garnix.io:CTFPyKSLcx5RMJKfLo5EEPUObbA78b0YQ2DTCJXqr9g="
    ];
  };
}
```

Next, create `src/index.ts`. This will contain most of our logic. Add a simple test:

```typescript
console.log("hello, world");
```

Run it with `deno run src/index.ts` to verify your environment works. You should see `hello, world` in your terminal.

## Managing wallets

Let's modify `index.ts` to create and fund two wallets. Note: This example hardcodes mnemonics for demonstration purposes. In production, always use proper key management services.

```typescript
import { createWalletClient, http } from "npm:viem";
import { mnemonicToAccount } from "npm:@viem/accounts";
import { sepolia, arbitrumSepolia } from "npm:viem/chains";

// Create wallet clients
const sepoliaWallet = createWalletClient({
  account: mnemonicToAccount(mnemonic1),
  chain: sepolia,
  transport: http(),
});

const arbitrumWallet = createWalletClient({
  account: mnemonicToAccount(mnemonic2),
  chain: arbitrumSepolia,
  transport: http(),
});

console.log(`Sepolia address: ${sepoliaWallet.account.address}`);
console.log(`Arbitrum address: ${arbitrumWallet.account.address}`);
```

Create two variables, `mnemonic1` and `mnemonic2`, each containing a 12-word sentence (space-separated) as a string. Run the script and save your Sepolia address.

To fund our Sepolia address for contract interactions, we'll use a [faucet](https://www.alchemy.com/faucets/ethereum-sepolia).

Let's verify our faucet funding by checking the balance:

```typescript
import { createPublicClient, http, formatEther } from "npm:viem";

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const balance = await sepoliaClient.getBalance({
  address: sepoliaWallet.account.address,
});

console.log(`Sepolia balance: ${formatEther(balance)} ETH (${balance} wei)`);
```

We use `formatEther` for human-readable output. The parenthesized value shows the raw balance. We'll discuss sats, decimals, and asset standards later, but note that ETH is stored in wei on-chain (1 ETH = 10^18 wei).

At this point, we have secured testnet funds and set up a local wallet (though not production-ready).

## Performing the Asset Transfer

To do the bridge operation, we'll directly interact with the Union contracts through their ABI. We'll use the [SDK](https://www.npmjs.com/package/@unionlabs/sdk) package.

```graphql
query Ucs03Channels @cached(ttl: 60) {
  v2_channel_recommendations(
    where: { _and: [{ version: { _eq: "ucs03-zkgm-0" } }] }
  ) {
    source_port_id
    source_chain_id
    source_channel_id
    source_connection_id
    destination_port_id
    destination_chain_id
    destination_channel_id
    destination_connection_id
  }
}
```

```graphql
getQuoteAsset
```

```typescript
import { ucs03abi } from "npm:@unionlabs/sdk/evm/abi";

walletClient.writeContract({
  account: account.address as `0x${string}`,
  abi: ucs03abi,
  chain: sepolia,
  functionName: "transferV2",
  address: transfer.ucs03address,
  value: BigInt(0.0080085 * 10 ** 18),
  args: [
    sourceChannelId,
    account.address as `0x${string}`,
    baseToken,
    baseAmount,
    quoteToken,
    quoteAmount,
    timeoutHeight,
    timeoutTimestamp,
    salt,
    transfer.wethQuoteToken,
  ],
});
```

The denomAddress is the ERC20 address of the asset we want to send. You might notice that regular ETH does not have an address, because it is not an ERC20. To perform the transfer, ETH must be wrapped to WETH:

```typescript
// WETH contract address on Sepolia
const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

// WETH ABI - we only need the deposit function for wrapping
const WETH_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

// Create the wallet client and transaction
const hash = await sepoliaWallet.writeContract({
  address: WETH_ADDRESS,
  abi: WETH_ABI,
  functionName: "deposit",
  value: parseEther("0.001"), // Amount of ETH to wrap
});

console.log(`Wrapping ETH: ${hash}`);
```

Next we need to construct the parameters to transfer the asset. We send all of our wrapped ETH, although we could send a different amount too.

<!-- TODO: with zkgm, this is a good section to briefly discuss how fees and filling work -->

```typescript
import type { TransferAssetsParameters } from "@unionlabs/client";

const transferPayload = {
  amount: parseEther("0.001"),
  autoApprove: true,
  destinationChainId: "421614",
  receiver: arbitrumWallet.account.address,
  denomAddress: WETH_ADDRESS,
} satisfies TransferAssetsParameters<"421614">;

const transfer = await unionClient.transferAsset(transferPayload);
console.info(`Transfer hash: ${transfer.value}`);
```

Once this transaction is included, the transfer is enqueued and will be picked up by a solver. Next we should monitor the transfer progression using an indexer. The easiest solution is \[graphql.union.build\], which is powered by \[`hubble`\]. Later we will endeavour to obtain the data directly from public RPCs as well.

## Tracking Transfer Progression

Once the transfer is enqueued onchain, we go through a pipeline of backend operations, which normally are opaque to the enduser, but useful for us for debugging (and fun to look at). Union refers to these steps as `Traces`, and they are indexed and stored for us by Hubble.

- SEND_PACKET
- LIGHTCLIENT_UPDATE
- RECV_PACKET
- ACKNOWLEDGE_PACKET

The `SEND_PACKET` was actually us performing the transfer. The other steps are executed by solvers. Later we will write a solver to explore what each entails.

To get the tracing data, we'll make a [Graphql](https://graphql.org/) query. For now we will just use `fetch` calls, but there are many high quality graphql clients around.

```typescript
let query = `
    query {
      v2_transfers(where: {transfer_send_transaction_hash:{_eq: "${transfer.value}"}}) {
        traces {
          type
          height
          chain { 
            display_name
            universal_chain_id
          }
        }
      }
    }
`;

const response = await fetch("https://graphql.union.build", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query,
    variables: {},
  }),
});

const data = await response.json();

console.log(data);
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

<!-- TASK: adjust the code to loop until all traces are there -->

Once we see the RECV_PACKET event, our funds will be usable on Arbitrum. The traces after that are used by the system to pay the solver, and maintain bookkeeping.

We can query Arbitrum for our balance to verify that we received funds:

<!-- TODO: this example should query ERC20 Balance -->

```typescript
import { createPublicClient, http, formatEther } from "npm:viem";

const arbitrumClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

const balance = await arbitrumClient.getBalance({
  address: arbitrumWallet.account.address,
});

console.log(`Arbitrum balance: ${formatEther(balance)} ETH (${balance} wei)`);
```

This should now return the amount sent, minus potential fees.

## Summary

This was a hands-on way to introduce you to multichain programming. We have ommitted the implementation details of many of the individual steps. You have now experienced the transfer flow that a regular user experiences when interacting through UIs. In the next chapter, we will go deeper into what each trace meant. Later we will write a simple solver, and show orders are filled.
