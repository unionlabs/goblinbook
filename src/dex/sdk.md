# SDK

Even though UI and design are out of scope for this guide, we will still go through interacting with our contract from Typescript. The code can be easily used inside React or Svelte applications.

## Setup

For our Javacript side logic, we will extend our flake.nix with the right tools:

```nix
{{ #shiftinclude  auto:../../projects/nexus/flake.nix:sdk-flake-nix }}
```

We can now scaffold our SDK project. Here we use Typescript as it helps us potentially catch more bugs early on.

```bash
nix develop
mkdir sdk && cd sdk
npm init
tsc --init
```

Set some sensible values when prompted:

```
package name: (nexus) sdk
version: (1.0.0)
description: SDK for the Nexus Exchange
entry point: (index.js)
test command:
git repository:
keywords:
author:
license: (ISC) MIT
```

Next we setup some default file:

```bash
mkdir src
echo 'console.log("Hello, TypeScript!");' > src/index.ts
```

As well as that we edit our package.json to configure Typescript. Extend the script section with a build and start script:

```json
"scripts": {
  "build": "tsc",
  "start": "ts-node src/index.ts",
}
```

We can now run our Typescript code by running

```
npm start

> sdk@1.0.0 start
> ts-node src/index.ts

Hello, TypeScript!
```

## Dependencies and Tools

We'll leverage `viem` to interact with our contracts. Depending on your frontend framework, you might also want to use `wagmi` if you are building a frontend application.

```bash
npm install viem
```

We can now import items from viem and use them. Add the following line to your index.ts.

```typescript
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
```

Have a look in the [viem](https://github.com/wevm/viem) repository to see what other features are available.

## ABI

We defined our contract logic already. Next we'll want to generate types to explain how to interact with our contract. We could redefine all the types ourselves, but it is better to parse the ABI:

```typescript
const abi = parseAbi([
  `struct Order {
    uint32 destinationChainId,
    bytes receiver,
    address baseToken,
    uint256 baseAmount,
    bytes quoteToken,
    uint256 quoteAmount,
    bytes32 salt
  }`,
  "function swap(Order order) external",
]);
```

Here we copied portion's of our ABI in index.ts. Even better is to actually point it to our contracts and generate bindings. For larger contracts and complex codebases, we recommend doing so.

## Interacting with Nexus

In this example, we will start a swap from Ethereum to other chains, so we will instantiate just a single client. In a real app, we would keep a record of chainIds to clients, and use a different client depending on the source chain.

```typescript
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// In a frontend app, we'd use the wallet extension instead of this one.
const account = mnemonicToAccount(
  "test test test test test test test test test test test junk",
);
const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
});
```

Our swap function is a simple contract call. We will first perform a simulation to verify it succeeds. Most likely, users will first need to grant an allowance to the `Nexus` contract before performing the swap.

```typescript
async function swap(order: Order) {
  const { request } = await publicClient.simulateContract({
    address: nexusAddress,
    abi,
    functionName: "swap",
    args: [order],
  });

  const hash = await walletClient.writeContract(request);

  return hash;
}
```

To perform a swap, we call the function:

```typescript
const order = {
  destinationChainId: 43114,
  receiver: "0x1234...",
  baseToken: "0xabcd...",
  baseAmount: BigInt("1000000000000000000"),
  quoteToken: "0x5678...",
  quoteAmount: BigInt("2000000000000000000"),
  salt: "0x1",
} as const;

const txHash = await swap(order);
console.log({ txHash });
```

Since we do not have a relayer running at the moment for our protocol, this will most likely not be processed. In the next section we shall configure a personal Voyager instance and ensure it has liquidity to solve for our protocol. Currently this call will fail, because we haven't whitelisted any routes yet. We will set that configuration now as well.

We can fetch 'recommended' channels from the API. Here we are looking for channels which use `zkgm`. The returned value shows you all available routes starting from Holesky.

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Command')">Get Routes</button>
  <button class="tablinks" onclick="openTab(event, 'Nix')">Nix</button>
</div>

<div id="Command" class="tabcontent">

```bash
gq https://graphql.union.build/v1/graphql -q '
{{ #shiftinclude auto:../queries/channel-recommendations-source-holesky.graphql }}'
```

</div>

<div id="Nix" class="tabcontent">

```bash
nix shell nixpkgs#nodePackages.graphqurl
```

</div>

We can set the route in Nexus by making a call with our deployer private key, using the `setChannelId` function. We will write a Typescript helperfunction again. First we extend the ABI definition:

```typescript
const abi = parseAbi([
  ...,
  "function setChannelId(uint32 destinationChainId, uint32 channelId) external onlyAdmin",
]);
```

And then we define our helper function:

```typescript
async function setChannelId(destinationChainId: number, channelId: number) {
  const { request } = await publicClient.simulateContract({
    address: nexusAddress,
    abi,
    functionName: "setChannelId",
    args: [destinationChainId, channelId],
  });

  const hash = await walletClient.writeContract(request);

  return hash;
}
```

We can call this using our admin private key (update the publicClient) and call the function with the right chainId and channelId to set the route.

Now our swap function will succeed and enqueue a swap.

## Indexing

Once the swap is enqueued and we receive the `txHash`, we can monitor it's progression through the indexer. We can query the details using `gq` again.

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Command')">Track Transfer</button>
  <button class="tablinks" onclick="openTab(event, 'Nix')">Nix</button>
</div>

<div id="Command" class="tabcontent">

```bash
gq https://graphql.union.build/v1/graphql -q '
{{ #shiftinclude auto:../queries/packets-by-tx-hash.graphql.ignore }}'
```

</div>

<div id="Nix" class="tabcontent">

```bash
nix shell nixpkgs#nodePackages.graphqurl
```

</div>

Inside our app, we should perodically poll (once every 3 seconds is reasonable). That way, we will see additional traces appear, which we can use to track the transfer progression. For executing the queries, we'll leverage `apollo`.

```typescript
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

const client = new ApolloClient({
  uri: "https://graphql.union.build",
  cache: new InMemoryCache(),
});

const PACKET_QUERY = gql`
  query GetPacket($txHash: String!) {
    v1_ibc_union_packets(
      where: { packet_send_transaction_hash: { _eq: $txHash } }
    ) {
      source_chain {
        display_name
      }
      destination_chain {
        display_name
      }
      packet_recv_transaction_hash
      data_decoded
      traces {
        type
        block_hash
        transaction_hash
        event_index
      }
    }
  }
`;
```

Apollo will so some typechecking and smart caching for us, which is very helpful. Notice how we now pass the `txHash` as an argument to the `PACKET_QUERY` as well.

For our poll function, we will continiously poll until we see the `RECV_PACKET` trace, which means that the packet has been received on the destination side. In actual frontends, we will want to do something similiar such as periodic polling, but connect these to our effects or stores.

```typescript
async function pollPacketStatus(txHash: string) {
  const interval = setInterval(async () => {
    try {
      const { data } = await client.query({
        query: PACKET_QUERY,
        variables: { txHash },
        fetchPolicy: "network-only", // Don't use cache
      });

      const packet = data.v1_ibc_union_packets[0];
      if (packet) {
        console.log({ packet });

        // Optional: Stop polling if we see a completion trace
        if (packet.traces.some((t) => t.type === "RECV_PACKET")) {
          clearInterval(interval);
        }
      }
    } catch (error) {
      console.error("Error polling packet:", error);
    }
  }, 3000);

  // Cleanup after 5 minutes to prevent indefinite polling
  setTimeout(() => clearInterval(interval), 300000);

  return () => clearInterval(interval); // Return cleanup function
}

pollPacketStatus(txHash);
```

We now have code to submit and track orders. In the next section, we shall see how to inspect historic orders for specific accounts and how to perform aggregate statistics on them.

## Next Steps

The Typescript code is still very limited, we lack ways to perform admin specific operations, as well as handling approvals, or querying for whitelisted assets.
