const { createPublicClient, createWalletClient, http, zeroAddress } = require("viem");
const { avalanche } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const sdk = require("@betswirl/sdk-core");

const RPC = "https://api.avax.network/ext/bc/C/rpc";

async function main() {
  const subId = process.argv[2];
  if (!subId) {
    console.error("Usage: node contracts/set-vrf-sub-mainnet.js <subscriptionId>");
    process.exit(1);
  }

  const deployment = require("./deployment-mainnet.json");
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: avalanche, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: avalanche, transport: http(RPC), account });

  console.log("CoinToss:", deployment.coinToss);
  console.log("Setting VRF subscription ID:", subId, "for AVAX (native)");

  const hash = await walletClient.writeContract({
    address: deployment.coinToss,
    abi: sdk.coinTossAbi,
    functionName: "setVRFSubId",
    args: [zeroAddress, BigInt(subId)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Done! tx:", hash);
  console.log("\nCoinToss is now ready to accept AVAX bets.");
  console.log("Test with: node contracts/test-bet-mainnet.js");
}

main().catch((err) => {
  console.error("Failed:", err.shortMessage || err.message || err);
  process.exit(1);
});
