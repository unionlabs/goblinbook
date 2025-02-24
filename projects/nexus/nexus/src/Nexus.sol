// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "union/evm/contracts/apps/ucs/03-zkgm/lib/ZkgmLib.sol";
import "union/evm/contracts/core/04-channel/IBCPacket.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // For onlyOwner

struct Order {
    uint32 destinationChainId,
    bytes receiver,
    address baseToken,
    uint256 baseAmount,
    bytes quoteToken,
    uint256 quoteAmount,
    bytes32 salt,
}

contract Nexus is Ownable {
    using ZkgmLib for *; // If it uses function extensions (optional)

    mapping(uint32 => uint32) public destinationToChannel;
    IIBCPacket public ibcHandler;
    
    // Constructor to set the IBC handler and initialize Ownable
    constructor(address _ibcHandler) Ownable(msg.sender) {
        require(_ibcHandler != address(0), "IBC handler address cannot be zero");
        ibcHandler = IIBCPacket(_ibcHandler);
    }

    function swap(Order order) {
        // 1. Get channel ID for destination chain
        bytes32 channelId = destinationToChannel[order.destinationChainId];
        require(channelId != bytes32(0), "Invalid destination chain");

        // 2. Transfer tokens from user to contract
        IERC20(order.baseToken).safeTransferFrom(
            msg.sender,
            address(this),
            order.baseAmount
        );

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

    function setChannelId(uint32 destinationChainId, uint32 channelId) external onlyAdmin {
        destinationToChannel[destinationChainId] = channelId;
    }
}
