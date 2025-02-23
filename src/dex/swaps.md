# Swaps

Our swaps implementation consists of two main components. (1). Typescript code calling our exchange contract, which then (2). turns the order into a set of `FungibleAssetOrder`s and submits it to the Union contract. We do not directly call the Union contract, because we want our own interface to provide a nice API for other smart contracts to use, as well as potentially build in governance controls.

## Nexus Smart Contract

Our smart contact will have a few functions, but the most important one is the simple `swap` function, which accepts and `Order` and executes it. 

```solidity
struct Order {
    uint32 destinationChainId,
    bytes receiver,
    address baseToken,
    uint256 baseAmount,
    bytes calldata quoteToken,
    uint256 quoteAmount,
    bytes32 salt,
}
```

Our order specifies the `destinationChainId`, which is where the user wants to receive their tokens. The `salt` is added to allow for orders of exactly the same amount and assets to function, since Union hashes orders against replay attacks, we need a way to alter that hash.

Next our swap function:

```solidity
function swap(Order order) {
    // 1. map destinationChainId to channelId
    // 2. transfer from msg.sender to self
    // 3. create routing instructions
    // 4. call the union contract 
}
```

We need to implement the 4 steps in our example.

### Chain ID to Channel Mapping

First, we need to map destination chain IDs to Union channel IDs. Union uses channels to route orders between chains. We could compute this on the frontend when submitting orders, but we want Nexus to be callable by other smart contracts as well, hence why we store the mapping.

```solidity
// Map of destination chain ID to Union channel ID
mapping(uint32 => bytes32) public destinationToChannel;

// Set by admin
function setChannelId(uint32 destinationChainId, bytes32 channelId) external onlyAdmin {
    destinationToChannel[destinationChainId] = channelId;
}
```

### Token Transfer

Next, we need to handle the ERC20 token transfer from user to Nexus contract:

```solidity
function swap(Order calldata order) external {
    // 1. Get channel ID for destination chain
    bytes32 channelId = destinationToChannel[order.destinationChainId];
    require(channelId != bytes32(0), "Invalid destination chain");

    // 2. Transfer tokens from user to contract
    IERC20(order.baseToken).safeTransferFrom(
        msg.sender,
        address(this),
        order.baseAmount
    );

    // 3. Create routing instructions (next up)
    // 4. Call Union contract (coming soon)
}
```

Currently we assume the tokens will always be ERC20, which means that we cannot support native Eth. Union's transfer app handles this by optionally performing [wrapping](https://github.com/unionlabs/union/blob/5f4607a0cba6b8db1991b1d24f08605e9ba8600e/evm/contracts/apps/ucs/03-zkgm/Zkgm.sol#L492C13-L492C17) for the user. This is a good addtion to the protocol to implement in a v2.

### Order Instructions

Next we will construct our `FungibleAssetOrder`. We use the values from the channel mapping and the order to create them, it's just a simple format operation.

```solidity
function swap(Order calldata order) external {
    // 1. Get channel ID for destination chain
    ...

    // 2. Transfer tokens from user to contract
    ...

    // 3. Create fungible asset order instruction
    Instruction memory instruction = Instruction({
        version: ZkgmLib.INSTR_VERSION_1,
        opcode: ZkgmLib.OP_FUNGIBLE_ASSET_ORDER,
        operand: ZkgmLib.encodeFungibleAssetOrder(
            FungibleAssetOrder({
                sender: abi.encodePacked(msg.sender),
                receiver: order.receiver,
                baseToken: abi.encodePacked(order.baseToken),
                baseTokenPath: 0,
                baseTokenSymbol: "", // We could add token metadata here
                baseTokenName: "",   // We could add token metadata here
                baseTokenDecimals: 18, // We could make this dynamic
                baseAmount: order.baseAmount,
                quoteToken: order.quoteToken,
                quoteAmount: order.quoteAmount
            })
        )
    });
}
```

### Submit the Order

When submitting the order, we should provide a `timeoutTimestamp`. If the order isn't completed before the timout, the funds will be refunded. This timeout will ensure that if solvers do not want to handle the order (because of price fluctuations) or if there is an outage on the Union network, the user will still receive their funds.

```solidity
function swap(Order calldata order) external {
    // 1. Get channel ID for destination chain
    ...

    // 2. Transfer tokens from user to contract
    ...

    // 3. Create fungible asset order instruction
    ...

    // 4. Send packet to Union protocol
    ibcHandler.sendPacket(
        channelId,
        timeoutTimestamp, // Could be current time + some buffer
        ZkgmLib.encode(
            ZkgmPacket({
                salt: order.salt,
                path: 0,
                instruction: Instruction({
                    version: ZkgmLib.INSTR_VERSION_0,
                    opcode: ZkgmLib.OP_BATCH,
                    operand: ZkgmLib.encodeBatch(
                        Batch({
                            instructions: [instruction]
                        })
                    )
                })
            })
        )
    );
}
```

Notice how for the order, we encode a `Batch`. This means that we could actually submit multiple orders at the same time, or add additional instructions, such as depositing gas for the user.

## Extending the Contract

### Relayer Fees

Right now our code relies on the fact that the relayer is paid by the price of the base assets being higher than the quote assets (which means it is a profitable trade for the relayer). If the price delta is too small, relayers will not pick up this order. We could extend the `Batch` to include a relayer tip as well.

### Supported Assets

Nexus will now create orders for any asset, which means that we might receive invalid orders which will always time out. Limiting the assets that we accept will prevent these errors from occuring. 

### Local Swaps

Right now we always submit orders to Union, but if the `destinationChainId == localChainId`, we could use a local dex instead.