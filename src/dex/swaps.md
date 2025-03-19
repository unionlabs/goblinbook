# Swaps

Our swaps implementation consists of two main components. (1). Typescript code calling our exchange contract, which then (2). turns the order into a set of `FungibleAssetOrder`s and submits it to the Union contract. We do not directly call the Union contract, because we want our own interface to provide a nice API for other smart contracts to use, as well as potentially build in governance controls.

## Project Setup

Start by creating a flake.nix. We will be using `foundry` and using our flake to manage the environment.

```nix
{{ #shiftinclude  auto:../../projects/nexus/flake.nix:swaps-flake-nix }}
{{ #shiftinclude  auto:../../projects/nexus/flake.nix:swaps-flake-nix-tail }}
```

Now you can run `nix develop` to activate the local environment and use `forge` and other tools. Verify the installation succeeded by running `forge init nexus`.

Next we need to install the Union evm contracts.

```bash
forge install OpenZeppelin/openzeppelin-contracts
forge install unionlabs/union@5f4607a0cba6b8db1991b1d24f08605e9ba8600e
```

You can choose a more recent commit hash as well by navigating to the Union [monorepo](https://github.com/unionlabs/union).

## Nexus Smart Contract

Our smart contact will have a few functions, but the most important one is the simple `swap` function, which accepts and `Order` and executes it.

```solidity
{{ #shiftinclude  auto:../../projects/nexus/nexus/src/Nexus.sol:order}}
```

Our order specifies the `destinationChainId`, which is where the user wants to receive their tokens. The `salt` is added to allow for orders of exactly the same amount and assets to function, since Union hashes orders against replay attacks, we need a way to alter that hash.

Next our swap function:

```solidity
{{ #shiftinclude  auto:../../projects/nexus/nexus/src/Nexus.sol:swap-intro}}
```

We need to implement the 4 steps in our example.

### Chain ID to Channel Mapping

First, we need to map destination chain IDs to Union channel IDs. Union uses channels to route orders between chains. We could compute this on the frontend when submitting orders, but we want Nexus to be callable by other smart contracts as well, hence why we store the mapping.

```solidity
{{ #shiftinclude  auto:../../projects/nexus/nexus/src/Nexus.sol:channel-mapping-storage}}

...

{{ #shiftinclude  auto:../../projects/nexus/nexus/src/Nexus.sol:set-channel-id}}

```

### Token Transfer

Next, we need to handle the ERC20 token transfer from user to Nexus contract:

```solidity
{{ #shiftinclude  auto:../../projects/nexus/nexus/src/Nexus.sol:swap-signature}}
{{ #include  ../../projects/nexus/nexus/src/Nexus.sol:swap-1}}

{{ #include  ../../projects/nexus/nexus/src/Nexus.sol:swap-2}}
}
```

Currently we assume the tokens will always be ERC20, which means that we cannot support native Eth. Union's transfer app handles this by optionally performing [wrapping](https://github.com/unionlabs/union/blob/5f4607a0cba6b8db1991b1d24f08605e9ba8600e/evm/contracts/apps/ucs/03-zkgm/Zkgm.sol#L492C13-L492C17) for the user. This is a good addtion to the protocol to implement in a v2.

### Order Instructions

Next we will construct our `FungibleAssetOrder`. We use the values from the channel mapping and the order to create them, it's just a simple format operation.

```solidity
{{ #shiftinclude  auto:../../projects/nexus/nexus/src/Nexus.sol:swap-signature}}
        ...

{{ #include  ../../projects/nexus/nexus/src/Nexus.sol:swap-3}}

}
```

### Submit the Order

To interact with the IBC contract, we will need to store it in our own contract. For now, let's pass it during construction.

```solidity
{{ #shiftinclude  auto:../../projects/nexus/nexus/src/Nexus.sol:constructor}}
```

When submitting the order, we should provide a `timeoutTimestamp`. If the order isn't completed before the timout, the funds will be refunded. This timeout will ensure that if solvers do not want to handle the order (because of price fluctuations) or if there is an outage on the Union network, the user will still receive their funds.

```solidity
function swap(Order calldata order) external {
        ...
{{ #include  ../../projects/nexus/nexus/src/Nexus.sol:swap-4}}
}
```

## Deployment

Finally we will deploy our contract to Holesky, to interact directly with Union testnet.

We can obtain the zkgm address (called **ucs03**) from Union's [deployment.json](https://github.com/unionlabs/union/blob/main/deployments/deployments.json).

```bash
forge create \
    --rpc-url $HOLESKY_RPC_URL \
    --private-key $PRIVATE_KEY \
    src/Nexus.sol:Nexus --constructor-args $IBC_HANDLER
```

This will deploy your contract. You will still need to configure the supported routes. We will do this in the [SDK](./dex/sdk.md) section.

## Extending the Contract

Once you've completed this part of the project, consider adding some additional features yourself, such as unit tests, events, or bigger features. A full codebase of the above code can be found [here](https://github.com/unionlabs/goblinbook/tree/main/projects/nexus). Feel free to clone and tinker around if you got stuck.

### Relayer Fees

Right now our code relies on the fact that the relayer is paid by the price of the base assets being higher than the quote assets (which means it is a profitable trade for the relayer). If the price delta is too small, relayers will not pick up this order. We could instead use the `Batch` instruction to include a relayer tip as well.

### Supported Assets

Nexus will now create orders for any asset, which means that we might receive invalid orders which will always time out. Limiting the assets that we accept will prevent these errors from occuring.

### Local Swaps

Right now we always submit orders to Union, but if the `destinationChainId == localChainId`, we could use a local dex instead.
