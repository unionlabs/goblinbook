// ANCHOR: managing-wallets-imports
import { createWalletClient, http } from "npm:viem";
import { mnemonicToAccount } from "npm:@viem/accounts";
import { sepolia, holesky } from "npm:viem/chains";
// ANCHOR_END: managing-wallets-imports

// ANCHOR: create-client-imports
import { createPublicClient, formatEther } from "npm:viem";
// ANCHOR_END: create-client-imports

// ANCHOR: approvals-imports
import { erc20Abi } from "viem";
// ANCHOR_END: approvals-imports

// ANCHOR: send-imports
import { Batch, FungibleAssetOrder } from "npm:@unionlabs/sdk/evm/ucs03";
import { ucs03abi } from "npm:@unionlabs/sdk/evm/abi";
import { toHex, type Hex } from "viem";
// ANCHOR_END: send-imports

// ANCHOR: wrapping-imports
import { parseEther } from "viem";
// ANCHOR_END: wrapping-imports

// @ts-ignore hack to print bigints as JavaScript does not support this by default
BigInt["prototype"].toJSON = function () {
  return this.toString();
};

async function main() {
  const memo = "memo memo memo memoe";

  // ANCHOR: managing-wallets
  const sepoliaWallet = createWalletClient({
    account: mnemonicToAccount(memo),
    chain: sepolia,
    transport: http(),
  });

  const holeskyWallet = createWalletClient({
    account: mnemonicToAccount(memo),
    chain: holesky,
    transport: http(),
  });

  console.log(`Sepolia address: ${sepoliaWallet.account.address}`);
  console.log(`Holesky address: ${holeskyWallet.account.address}`);
  // ANCHOR_END: managing-wallets

  // ANCHOR: create-client
  const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const balance = await sepoliaClient.getBalance({
    address: sepoliaWallet.account.address,
  });

  console.log(`Sepolia balance: ${formatEther(balance)} ETH (${balance} wei)`);
  // ANCHOR_END: create-client

  // https://github.com/unionlabs/union/blob/97e5e8346f824e482185953a6648ad8b9bed9ac3/deployments/deployments.json#L256
  const ucs03address = "0x84F074C15513F15baeA0fbEd3ec42F0Bd1fb3efa";
  const sourceChannelId = 2;
  // https://sepolia.etherscan.io/token/0x7b79995e5f793a07bc00c21412e50ecae098e7f9
  const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

  // ANCHOR: wrapping
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
    value: parseEther("0.0001"), // Amount of ETH to wrap
  });

  console.log(`Wrapping ETH: ${hash}`);
  // ANCHOR_END: wrapping

  // ANCHOR: approvals
  await sepoliaWallet.writeContract({
    address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    abi: erc20Abi,
    functionName: "approve",
    args: [ucs03address, 100000000000n],
  });
  // ANCHOR_END: approvals

  // ANCHOR: send
  function generateSalt() {
    const rawSalt = new Uint8Array(32);
    crypto.getRandomValues(rawSalt);
    return toHex(rawSalt) as Hex;
  }

  let transferHash = await sepoliaWallet.writeContract({
    account: sepoliaWallet.account.address as `0x${string}`,
    abi: ucs03abi,
    chain: sepolia,
    functionName: "send",
    address: ucs03address,
    args: [
      // obtained from the graphql Channels query
      sourceChannelId,
      // this transfer is timeout out by timestamp, so we set height to 0.
      0n,
      // The actual timeout. It is current time + 2 hours.
      BigInt(Math.floor(Date.now() / 1000) + 7200),
      generateSalt(),
      // We're actually enqueuing two transfers, the main transfer, and fee.
      Batch([
        // Our main transfer.
        FungibleAssetOrder([
          sepoliaWallet.account.address,
          holeskyWallet.account.address,
          WETH_ADDRESS,
          4n,
          // symbol
          "WETH",
          // name
          "Wrapped Ether",
          // decimals
          18,
          // path
          0n,
          // quote token
          "0x685a6d912eced4bdd441e58f7c84732ceccbd1e4",
          // quote amount
          4n,
        ]),
        // Our fee transfer.
        FungibleAssetOrder([
          sepoliaWallet.account.address,
          holeskyWallet.account.address,
          WETH_ADDRESS,
          1n,
          // symbol
          "WETH",
          // name
          "Wrapped Ether",
          // decimals
          18,
          // path
          0n,
          // quote token
          "0x685a6d912eced4bdd441e58f7c84732ceccbd1e4",
          // quote amount
          0n,
        ]),
      ]),
    ],
  });
  // ANCHOR_END: send

  // ANCHOR: query-traces
  let query = `
    query {
        v2_transfers(where: {transfer_send_transaction_hash:{_eq: "${transferHash}"}}) {
            traces {
                type
                height
                chain { 
                    display_name
                    universal_chain_id
                }
            }
        }
    }`;

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
  // ANCHOR_END: query-traces

  // ANCHOR: verify-balance
  const holeskyClient = createPublicClient({
    chain: holesky,
    transport: http(),
  });

  const holeskyBalance = await holeskyClient.readContract({
    address: "0x685a6d912eced4bdd441e58f7c84732ceccbd1e4",
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [holeskyWallet.account.address],
  });

  const formattedBalance = balance / 10n ** BigInt(18);

  console.log(`Token balance: ${formattedBalance} (${holeskyBalance})`);
  // ANCHOR_END: verify-balance
}

main();
