// ANCHOR: initial-imports
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
// ANCHOR_END: initial-imports

// ANCHOR: imports-2
import { mainnet } from "viem/chains";
import { mnemonicToAccount } from "viem/accounts";
// ANCHOR_END: imports-2

// ANCHOR: abi-full
// ANCHOR: abi-1
// ANCHOR: abi-signature
const abi = parseAbi([
  // ANCHOR_END: abi-signature
  `struct Order {
      uint32 destinationChainId,
      bytes receiver,
      address baseToken,
      uint256 baseAmount,
      bytes quoteToken,
      uint256 quoteAmount,
      bytes32 salt
    }`,
  `function swap(Order order) external`,
  // ANCHOR_END: abi-1
  // ANCHOR: abi-2
  `function setChannelId(uint32 destinationChainId, uint32 channelId)`,
  // ANCHOR_END: abi-2

  // ANCHOR: abi-3
]);
// ANCHOR_END: abi-3

interface Order {
  destinationChainId: number; // uint32
  receiver: `0x${string}` | Uint8Array; // bytes
  baseToken: `0x${string}`; // address
  baseAmount: bigint; // uint256
  quoteToken: `0x${string}` | Uint8Array; // bytes
  quoteAmount: bigint; // uint256
  salt: `0x${string}`; // bytes32
}
// ANCHOR_END: abi-full

// ANCHOR: client
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
// ANCHOR_END: client

const nexusAddress = "0x";

// ANCHOR: swap
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
// ANCHOR_END: swap

// ANCHOR: do-swap
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
// ANCHOR_END: do-swap

// ANCHOR: set-channel-id
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
// ANCHOR_END: set-channel-id

// ANCHOR: poll-packet
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

const client = new ApolloClient({
  uri: "https://development.graphql.union.build/v1/graphql",
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
// ANCHOR_END: poll-packet

// ANCHOR: poll-packet-status
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
        if (packet.traces.some((t) => t.type === "PACKET_RECV")) {
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
// ANCHOR_END: poll-packet-status
