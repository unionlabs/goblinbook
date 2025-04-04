# SDK

Even though UI and design are out of scope for this guide, we will still go through interacting with our contract from Typescript. The code can be easily used inside React or Svelte applications.

## Setup

For our JavaScript side logic, we will extend our flake.nix with the right tools:

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
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:initial-imports}}
```

Have a look in the [viem](https://github.com/wevm/viem) repository to see what other features are available.

## ABI

We defined our contract logic already. Next we'll want to generate types to explain how to interact with our contract. We could redefine all the types ourselves, but it is better to parse the ABI:

```typescript
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:abi-1}}
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:abi-3}}
```

Here we copied portion's of our ABI in index.ts. Even better is to actually point it to our contracts and generate bindings. For larger contracts and complex codebases, we recommend doing so.

## Interacting with Nexus

In this example, we will start a swap from Ethereum to other chains, so we will instantiate just a single client. In a real app, we would keep a record of chainIds to clients, and use a different client depending on the source chain.

```typescript
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:imports-2}}

{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:client}}
```

Our swap function is a simple contract call. We will first perform a simulation to verify it succeeds. Most likely, users will first need to grant an allowance to the `Nexus` contract before performing the swap.

```typescript
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:swap}}
```

To perform a swap, we call the function:

```typescript
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:do-swap}}
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
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:abi-signature}}
    ...,
{{ #include ../../projects/nexus/sdk/src/index.ts:abi-2}}
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:abi-3}}
```

And then we define our helper function:

```typescript
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:set-channel-id}}
```

We can call this using our admin private key (update the publicClient) and call the function with the right chainId and channelId to set the route.

Now our swap function will succeed and enqueue a swap.

## Indexing

Once the swap is enqueued and we receive the `txHash`, we can monitor it's progression through the indexer. We can query the details using `gq` again, but we will leave that up for you to figure out.

Inside our app, we should perodically poll (once every 3 seconds is reasonable). That way, we will see additional traces appear, which we can use to track the transfer progression. For executing the queries, we'll leverage `apollo`.

```typescript
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:poll-packet}}
```

Apollo will so some typechecking and smart caching for us, which is very helpful. Notice how we now pass the `txHash` as an argument to the `PACKET_QUERY` as well.

For our poll function, we will continiously poll until we see the `PACKET_RECV` trace, which means that the packet has been received on the destination side. In actual frontends, we will want to do something similiar such as periodic polling, but connect these to our effects or stores.

```typescript
{{ #shiftinclude  auto:../../projects/nexus/sdk/src/index.ts:poll-packet-status}}
```

We now have code to submit and track orders. In the next section, we shall see how to inspect historic orders for specific accounts and how to perform aggregate statistics on them.

## Next Steps

The Typescript code is still very limited, we lack ways to perform admin specific operations, as well as handling approvals, or querying for whitelisted assets.
