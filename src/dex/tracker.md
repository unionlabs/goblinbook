# Historic data

We will want to analyze our orderflow and expose a personal dashboard to our users. For performance reasons, we don't solely want to rely on the Union graphql API, as refetching loads of data is inefficient. Instead we will use build a data warehouse on Postgresql, which we can combine with TimescaleDB and other plugins for advanced analysis.

## Features

Any good trading tracker should show historic trades. This means that we will want to obtain a stream of all trades going through Nexus, which we can divide by users later on. To be able to filter for our own trades, we need to alter the orders we are submitting to Union, and adding a `tag`.

```solidity
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
```

