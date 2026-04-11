const { createPublicClient, createWalletClient, http } = require("viem");
const { avalancheFuji } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const sdk = require("@betswirl/sdk-core");

const RPC = "https://api.avax-test.network/ext/bc/C/rpc";

async function main() {
  const subId = process.argv[2];
  if (!subId) {
    console.error("Usage: node contracts/set-vrf-sub.js <subscriptionId>");
    process.exit(1);
  }

  const deployment = require("./deployment-fuji.json");
  const betToken = deployment.betToken;
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: avalancheFuji, transport: http(RPC), account });

  console.log("Setting VRF subscription ID", subId, "for token", betToken, "on CoinToss", deployment.coinToss);
  const hash = await walletClient.writeContract({
    address: deployment.coinToss,
    abi: sdk.coinTossAbi,
    functionName: "setVRFSubId",
    args: [betToken, BigInt(subId)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Done! tx:", hash);
  console.log("\nCoinToss is now fully configured and ready to accept LINK bets.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
