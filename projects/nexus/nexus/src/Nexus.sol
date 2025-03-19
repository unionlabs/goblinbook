// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "union/evm/contracts/apps/ucs/03-zkgm/IZkgm.sol";
import "union/evm/contracts/apps/ucs/03-zkgm/Types.sol";
import "union/evm/contracts/apps/ucs/03-zkgm/Lib.sol";
import "union/evm/contracts/core/04-channel/IBCPacket.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // For onlyOwner

# ANCHOR: order
struct Order {
    uint32 destinationChainId;
    bytes receiver;
    address baseToken;
    uint256 baseAmount;
    bytes quoteToken;
    uint256 quoteAmount;
    bytes32 salt;
    uint64 timeoutTimestamp;
}
# ANCHOR_END: order

contract Nexus is Ownable {
    using ZkgmLib for *; // If it uses function extensions (optional)
    using SafeERC20 for *; // If it uses function extensions (optional)

    # ANCHOR: constructor
    IZkgm public zkgm;

    // Constructor to set the zkgm contract and initialize Ownable
    constructor(address _zkgm) Ownable(msg.sender) {
        require(_zkgm != address(0), "zkgm address cannot be zero");
        zkgm = IZkgm(_zkgm);
    }
    # ANCHOR_END: constructor


    # ANCHOR: channel-mapping-storage
    mapping(uint32 => uint32) public destinationToChannel;
    # ANCHOR_END: channel-mapping-storage




    # ANCHOR: swap-intro
    # ANCHOR: swap-signature
    function swap(Order memory order) public {
    # ANCHOR_END: swap-signature
        // 1. Get channel ID for destination chain
        // 2. Transfer tokens from user to contract
        // 3. Create fungible asset order instruction
        // 4. Call zkgm contract
    # ANCHOR_END: swap-intro

        # ANCHOR: swap-1
        // 1. Get channel ID for destination chain
        uint32 channelId = destinationToChannel[order.destinationChainId];
        require(channelId != 0, "Invalid destination chain");
        # ANCHOR_END: swap-1

        # ANCHOR: swap-2
        // 2. Transfer tokens from user to contract
        IERC20(order.baseToken).safeTransferFrom(
            msg.sender,
            address(this),
            order.baseAmount
        );
        # ANCHOR_END: swap-2

        # ANCHOR: swap-3
        // 3. Create fungible asset order instruction
        Instruction memory instruction = zkgm.makeFungibleAssetOrder(
            0,
            channelId,
            msg.sender,
            order.receiver,
            order.baseToken,
            order.baseAmount,
            order.quoteToken,
            order.quoteAmount
        );
        # ANCHOR_END: swap-3

        # ANCHOR: swap-4
        // 4. Call zkgm contract
        zkgm.send(
            channelId,
            order.timeoutTimestamp, // Could be current time + some buffer
            0, // Optional block timeout
            order.salt,
            instruction
        );
        # ANCHOR_END: swap-4
    }

    # ANCHOR: set-channel-id
    function setChannelId(uint32 destinationChainId, uint32 channelId) external onlyOwner {
        destinationToChannel[destinationChainId] = channelId;
    }
    # ANCHOR_END: set-channel-id
}
