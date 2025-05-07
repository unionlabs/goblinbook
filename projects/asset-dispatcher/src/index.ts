// ANCHOR: managing-wallets-imports
import { createWalletClient, http } from "npm:viem";
import { mnemonicToAccount } from "npm:viem/accounts";
import { holesky, sepolia } from "npm:viem/chains";
// ANCHOR_END: managing-wallets-imports

// ANCHOR: create-client-imports
import { createPublicClient, formatEther } from "npm:viem";
// ANCHOR_END: create-client-imports

// ANCHOR: approvals-imports
import { erc20Abi } from "npm:viem";
// ANCHOR_END: approvals-imports

// ANCHOR: send-imports
import { Instruction } from "npm:@unionlabs/sdk/ucs03";
import { ucs03abi } from "npm:@unionlabs/sdk/evm/abi";
import { type Hex, toHex } from "npm:viem";
// ANCHOR_END: send-imports

// ANCHOR: wrapping-imports
import { parseEther } from "npm:viem";
// ANCHOR_END: wrapping-imports

// @ts-ignore hack to print bigints as JavaScript does not support this by default
BigInt["prototype"].toJSON = function () {
  return this.toString();
};

async function main() {
  const mnemonic = "replace me";

  // ANCHOR: managing-wallets
  const sepoliaWallet = createWalletClient({
    account: mnemonicToAccount(mnemonic),
    chain: sepolia,
    transport: http(),
  });

  const holeskyWallet = createWalletClient({
    account: mnemonicToAccount(mnemonic),
    chain: holesky,
    transport: http(),
  });

  console.log(`Sepolia address: ${sepoliaWallet.account.address}`);
  console.log(`Holesky address: ${holeskyWallet.account.address}`);
  // ANCHOR_END: managing-wallets

  // https://github.com/unionlabs/union/blob/97e5e8346f824e482185953a6648ad8b9bed9ac3/deployments/deployments.json#L256
  const ucs03address = "0x5fbe74a283f7954f10aa04c2edf55578811aeb03";
  const sourceChannelId = 8;
  // https://sepolia.etherscan.io/token/0x7b79995e5f793a07bc00c21412e50ecae098e7f9
  const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

  // ANCHOR: create-client
  const sepoliaClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const gasBalance = await sepoliaClient.getBalance({
    address: sepoliaWallet.account.address,
  });

  const erc20Balance = await sepoliaClient.readContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [sepoliaWallet.account.address],
  });

  console.log([
    `Sepolia Gas Balance:   ${formatEther(gasBalance)} ETH (${gasBalance} wei)`,
    `Sepolia Token Balance: ${formatEther(erc20Balance)} WETH`,
  ].join("\n"));
  // ANCHOR_END: create-client

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

  // We're actually enqueuing two transfers, the main transfer, and fee.
  const instruction = new Instruction.Batch({
    operand: [
      // Our main transfer.
      new Instruction.FungibleAssetOrder({
        operand: [
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
          "0xb476983cc7853797fc5adc4bcad39b277bc79656",
          // quote amount
          4n,
        ],
      }),
      // Our fee transfer.
      new Instruction.FungibleAssetOrder({
        operand: [
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
          "0xb476983cc7853797fc5adc4bcad39b277bc79656",
          // quote amount
          0n,
        ],
      }),
    ],
  });

  const transferHash = await sepoliaWallet.writeContract({
    abi: ucs03abi,
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
      {
        opcode: instruction.opcode,
        version: instruction.version,
        operand: Instruction.encodeAbi(instruction),
      },
    ],
  });
  // ANCHOR_END: send

  // ANCHOR: query-traces
  const query = `
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

  const result = await new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const request = fetch("https://graphql.union.build/v1/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables: {},
          }),
        });

        const response = await request;
        const json = await response.json();
        const transfers = json.data["v2_transfers"];

        console.log({ json });

        if (transfers?.length) {
          clearInterval(interval);
          resolve(transfers);
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 5_000);
  });

  console.log(result);
  // ANCHOR_END: query-traces

  // ANCHOR: verify-balance
  const holeskyClient = createPublicClient({
    chain: holesky,
    transport: http(),
  });

  const holeskyBalance = await holeskyClient.readContract({
    address: "0xb476983cc7853797fc5adc4bcad39b277bc79656",
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [holeskyWallet.account.address],
  });

  const formattedBalance = gasBalance / 10n ** BigInt(18);

  console.log(
    `Token balance: ${formatEther(formattedBalance)} (${holeskyBalance})`,
  );
  // ANCHOR_END: verify-balance
}

main();
