const {
  createPublicClient, createWalletClient, http, formatEther,
  parseEther, encodeFunctionData, decodeFunctionResult, zeroAddress,
} = require("viem");
const { avalanche } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const sdk = require("@betswirl/sdk-core");

const RPC = "https://api.avax.network/ext/bc/C/rpc";
const deployment = require("./deployment-mainnet.json");

async function main() {
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: avalanche, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: avalanche, transport: http(RPC), account });

  console.log("Deployer:", account.address);
  console.log("CoinToss:", deployment.coinToss);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("AVAX Balance:", formatEther(balance));

  // Get VRF cost
  const gasPrice = await publicClient.getGasPrice();
  const effectiveGasPrice = gasPrice > 25_000_000_000n ? gasPrice : 25_000_000_000n;

  let vrfCost;
  try {
    const vrfData = encodeFunctionData({
      abi: sdk.coinTossAbi,
      functionName: "getChainlinkVRFCost",
      args: [zeroAddress, 1],
    });
    const vrfResult = await publicClient.call({
      to: deployment.coinToss,
      data: vrfData,
      gasPrice: effectiveGasPrice,
      account: account.address,
      gas: 500_000n,
    });
    vrfCost = decodeFunctionResult({
      abi: sdk.coinTossAbi,
      functionName: "getChainlinkVRFCost",
      data: vrfResult.data,
    });
    console.log("VRF cost:", formatEther(vrfCost), "AVAX");
  } catch (e) {
    console.log("VRF cost failed:", e.shortMessage || e.message);
    console.log("Using fallback: 0.05 AVAX");
    vrfCost = parseEther("0.05");
  }

  const betAmount = parseEther("0.01"); // 0.01 AVAX bet
  const vrfWithBuffer = vrfCost > 0n ? (vrfCost * 150n / 100n) : parseEther("0.05");
  const totalValue = betAmount + vrfWithBuffer;

  console.log("\nPlacing 0.01 AVAX bet on HEADS");
  console.log("msg.value:", formatEther(totalValue), "AVAX (bet + VRF)");

  const betHash = await walletClient.writeContract({
    address: deployment.coinToss,
    abi: sdk.coinTossAbi,
    functionName: "wager",
    args: [
      true,
      account.address,
      account.address,
      {
        token: zeroAddress,
        betAmount,
        betCount: 1,
        stopGain: 0n,
        stopLoss: 0n,
        maxHouseEdge: 1000,
      },
    ],
    value: totalValue,
    gas: 500_000n,
  });
  console.log("Bet tx:", betHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: betHash });
  console.log("Status:", receipt.status);

  if (receipt.status === "reverted") {
    console.log("BET REVERTED! Check VRF subscription and config.");
    return;
  }

  console.log("\nWaiting for VRF callback (Roll event)...");
  const rollEvent = {
    type: "event",
    name: "Roll",
    inputs: [
      { type: "uint256", name: "id", indexed: true },
      { type: "address", name: "receiver", indexed: true },
      { type: "address", name: "token", indexed: true },
      { type: "uint256", name: "totalBetAmount" },
      { type: "bool", name: "face" },
      { type: "bool[]", name: "rolled" },
      { type: "uint256", name: "payout" },
    ],
  };

  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write((i + 1) * 5 + "s.. ");
    try {
      const block = await publicClient.getBlockNumber();
      const logs = await publicClient.getLogs({
        address: deployment.coinToss,
        event: rollEvent,
        fromBlock: block > 200n ? block - 200n : 0n,
        toBlock: "latest",
      });
      if (logs.length > 0) {
        const roll = logs[logs.length - 1];
        console.log("\n\n=== RESULT ===");
        console.log("Landed:", roll.args.rolled[0] ? "HEADS" : "TAILS");
        console.log("Payout:", formatEther(roll.args.payout), "AVAX");
        console.log("Won:", roll.args.payout > 0n ? "YES" : "NO");
        console.log("==============");

        const newBal = await publicClient.getBalance({ address: account.address });
        console.log("AVAX balance after:", formatEther(newBal));
        return;
      }
    } catch (_) {}
  }
  console.log("\nNo VRF callback after 3 min. Check subscription funding & consumer registration.");
}

main().catch((err) => {
  console.error("ERROR:", err.shortMessage || err.message || err);
  process.exit(1);
});
