const {
  createPublicClient, createWalletClient, http, formatEther,
  parseEther, encodeFunctionData, decodeFunctionResult, erc20Abi,
} = require("viem");
const { avalancheFuji } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const sdk = require("@betswirl/sdk-core");

const RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const LINK = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
const deployment = require("./deployment-fuji.json");

async function main() {
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: avalancheFuji, transport: http(RPC), account });

  console.log("Deployer:", account.address);
  console.log("CoinToss:", deployment.coinToss);

  const avaxBal = await publicClient.getBalance({ address: account.address });
  const linkBal = await publicClient.readContract({
    address: LINK, abi: erc20Abi, functionName: "balanceOf", args: [account.address],
  });
  console.log("AVAX:", formatEther(avaxBal));
  console.log("LINK:", formatEther(linkBal));

  // Get VRF cost with explicit gas price
  const gasPrice = await publicClient.getGasPrice();
  const effectiveGasPrice = gasPrice > 25000000000n ? gasPrice : 25000000000n; // min 25 gwei
  console.log("Raw gas price:", gasPrice.toString(), "effective:", effectiveGasPrice.toString());

  let vrfCost;
  try {
    const vrfData = encodeFunctionData({
      abi: sdk.coinTossAbi,
      functionName: "getChainlinkVRFCost",
      args: [LINK, 1],
    });
    console.log("VRF call data length:", vrfData.length);
    const vrfResult = await publicClient.call({
      to: deployment.coinToss,
      data: vrfData,
      gasPrice: effectiveGasPrice,
      account: account.address,
      gas: 500000n,
    });
    console.log("VRF raw result:", vrfResult.data);
    vrfCost = decodeFunctionResult({
      abi: sdk.coinTossAbi,
      functionName: "getChainlinkVRFCost",
      data: vrfResult.data,
    });
    console.log("VRF cost:", formatEther(vrfCost), "AVAX");
  } catch (e) {
    console.log("VRF cost call failed:", e.shortMessage || e.message);
    console.log("Using fallback VRF cost of 0.01 AVAX");
    vrfCost = parseEther("0.01");
  }

  // Approve CoinToss to spend LINK
  const betAmount = parseEther("0.1");
  console.log("\nApproving CoinToss to spend", formatEther(betAmount), "LINK...");
  const approveHash = await walletClient.writeContract({
    address: LINK, abi: erc20Abi, functionName: "approve",
    args: [deployment.coinToss, betAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("Approved:", approveHash);

  // Place bet: heads, 0.1 LINK, msg.value = VRF cost only
  const vrfWithBuffer = vrfCost > 0n ? (vrfCost * 150n / 100n) : parseEther("0.01");
  console.log("Placing 0.1 LINK bet on HEADS, VRF value:", formatEther(vrfWithBuffer), "AVAX");

  const betHash = await walletClient.writeContract({
    address: deployment.coinToss,
    abi: sdk.coinTossAbi,
    functionName: "wager",
    args: [
      true,
      account.address,
      account.address,
      {
        token: LINK,
        betAmount: betAmount,
        betCount: 1,
        stopGain: 0n,
        stopLoss: 0n,
        maxHouseEdge: 1000,
      },
    ],
    value: vrfWithBuffer,
    gas: 500000n,
    gasPrice: effectiveGasPrice,
  });
  console.log("Bet tx:", betHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: betHash });
  console.log("Status:", receipt.status);
  console.log("Gas used:", receipt.gasUsed.toString());

  if (receipt.status === "reverted") {
    console.log("BET REVERTED! Check contract config.");
    return;
  }

  // Find PlaceBet event
  const ctLogs = receipt.logs.filter(
    (l) => l.address.toLowerCase() === deployment.coinToss.toLowerCase()
  );
  console.log("CoinToss events:", ctLogs.length);
  let betId;
  if (ctLogs.length > 0) {
    betId = BigInt(ctLogs[0].topics[1]);
    console.log("Bet ID:", betId.toString());
  }

  // Poll for Roll event
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
        console.log("\n\n=== ROLL RESULT ===");
        console.log("Bet ID:", roll.args.id.toString());
        console.log("Bet on: HEADS");
        console.log("Landed:", roll.args.rolled[0] ? "HEADS" : "TAILS");
        console.log("Payout:", formatEther(roll.args.payout), "LINK");
        console.log("Won:", roll.args.payout > 0n ? "YES!" : "NO");
        console.log("===================");

        const newLinkBal = await publicClient.readContract({
          address: LINK, abi: erc20Abi, functionName: "balanceOf", args: [account.address],
        });
        console.log("LINK balance after:", formatEther(newLinkBal));
        return;
      }
    } catch (e) {
      // ignore polling errors
    }
  }
  console.log("\nVRF callback not received after 3 min. Check VRF subscription funding.");
}

main().catch((err) => {
  console.error("ERROR:", err.shortMessage || err.message || err);
  process.exit(1);
});
