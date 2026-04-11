const {
  createPublicClient, createWalletClient, http, encodeAbiParameters,
  parseAbiParameters, formatEther, parseEther, encodeFunctionData,
  decodeFunctionResult, erc20Abi,
} = require("viem");
const { avalancheFuji } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const sdk = require("@betswirl/sdk-core");

const RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const LINK_FUJI = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
const VRF_COORDINATOR_FUJI = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE";
const VRF_WRAPPER_FUJI = "0x327B83F409E1D5f13985c6d0584420FA648f1F56";
const VRF_KEYHASH_FUJI = "0xc799bd1e3bd4d1a41cd4968997a4e03dfd2a3c7c04b695881138580163f42887";
const WAVAX_FUJI = "0xd00ae08403B9bbb9124bB305C09058E32C39A48c";

const HOUSE_EDGE_BP = 400;
const REFUND_TIME = 86400n;
const MAX_CALL_GAS = 30000n;
const VRF_CALLBACK_GAS_BASE = 294000;
const VRF_REQUEST_CONFIRMATIONS = 1;

async function main() {
  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "deployment-fuji.json"), "utf8"));
  const bankAddress = deployment.bank;

  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: avalancheFuji, transport: http(RPC), account });

  console.log("Deployer:", account.address);
  console.log("Bank:", bankAddress);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("AVAX Balance:", formatEther(balance));

  // --- Re-deploy CoinToss with MORE gas ---
  console.log("\n=== Re-deploying CoinToss (8M gas) ===");
  const ctBytecode = fs.readFileSync(path.join(__dirname, "cointoss-bytecode.txt"), "utf8").trim();
  const ctConstructorArgs = encodeAbiParameters(
    parseAbiParameters("address, address, address, address, uint64, uint256"),
    [bankAddress, VRF_COORDINATOR_FUJI, VRF_WRAPPER_FUJI, WAVAX_FUJI, REFUND_TIME, MAX_CALL_GAS]
  );

  const ctDeployHash = await walletClient.sendTransaction({
    data: (ctBytecode + ctConstructorArgs.slice(2)),
    gas: 8_000_000n,
  });
  console.log("CoinToss deploy tx:", ctDeployHash);
  const ctReceipt = await publicClient.waitForTransactionReceipt({ hash: ctDeployHash });

  if (ctReceipt.status === "reverted") {
    console.error("CoinToss deployment REVERTED! Gas used:", ctReceipt.gasUsed.toString());
    process.exit(1);
  }

  const coinTossAddress = ctReceipt.contractAddress;
  console.log("CoinToss deployed at:", coinTossAddress);
  console.log("Gas used:", ctReceipt.gasUsed.toString());

  const code = await publicClient.getCode({ address: coinTossAddress });
  if (!code || code.length < 10) {
    console.error("No code at CoinToss address! Deployment failed.");
    process.exit(1);
  }
  console.log("Contract code verified:", code.length, "bytes");

  // --- Grant GAME_ROLE to new CoinToss ---
  console.log("\n=== Configuring ===");
  const gameRoleData = encodeFunctionData({ abi: sdk.bankAbi, functionName: "GAME_ROLE", args: [] });
  const gameRoleResult = await publicClient.call({ to: bankAddress, data: gameRoleData });
  const gameRole = decodeFunctionResult({ abi: sdk.bankAbi, functionName: "GAME_ROLE", data: gameRoleResult.data });

  console.log("Granting GAME_ROLE to new CoinToss...");
  const grantHash = await walletClient.writeContract({
    address: bankAddress, abi: sdk.bankAbi, functionName: "grantRole",
    args: [gameRole, coinTossAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: grantHash });
  console.log("  done:", grantHash);

  // Set Chainlink VRF config
  console.log("Setting Chainlink VRF config...");
  const chainlinkHash = await walletClient.writeContract({
    address: coinTossAddress, abi: sdk.coinTossAbi, functionName: "setChainlinkConfig",
    args: [VRF_REQUEST_CONFIRMATIONS, VRF_KEYHASH_FUJI, VRF_WRAPPER_FUJI, 2000, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: chainlinkHash });
  console.log("  done:", chainlinkHash);

  // Set house edge
  console.log("Setting house edge to", HOUSE_EDGE_BP, "BP...");
  const edgeHash = await walletClient.writeContract({
    address: coinTossAddress, abi: sdk.coinTossAbi, functionName: "setHouseEdge",
    args: [LINK_FUJI, HOUSE_EDGE_BP],
  });
  await publicClient.waitForTransactionReceipt({ hash: edgeHash });
  console.log("  done:", edgeHash);

  // Set VRF callback gas base
  console.log("Setting VRF callback gas base to", VRF_CALLBACK_GAS_BASE, "...");
  const gasBaseHash = await walletClient.writeContract({
    address: coinTossAddress, abi: sdk.coinTossAbi, functionName: "setVRFCallbackGasBase",
    args: [LINK_FUJI, VRF_CALLBACK_GAS_BASE],
  });
  await publicClient.waitForTransactionReceipt({ hash: gasBaseHash });
  console.log("  done:", gasBaseHash);

  // --- Verify token config ---
  console.log("\n=== Verifying ===");
  try {
    const tokenConfig = await publicClient.readContract({
      address: coinTossAddress, abi: sdk.coinTossAbi, functionName: "tokens", args: [LINK_FUJI],
    });
    console.log("Token config:", tokenConfig);
  } catch (e) {
    console.log("Token read:", e.shortMessage || e.message);
  }

  try {
    const paused = await publicClient.readContract({
      address: coinTossAddress, abi: sdk.coinTossAbi, functionName: "paused", args: [],
    });
    console.log("Paused:", paused);
  } catch (e) {
    console.log("Paused read:", e.shortMessage || e.message);
  }

  // --- Update deployment file ---
  deployment.coinToss = coinTossAddress;
  deployment.redeployedAt = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, "deployment-fuji.json"), JSON.stringify(deployment, null, 2));

  console.log("\n========================================");
  console.log("  REDEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("New CoinToss:", coinTossAddress);
  console.log("\nMANUAL STEP REQUIRED:");
  console.log("Add new CoinToss as VRF consumer at https://vrf.chain.link/fuji");
  console.log("Then run: node contracts/set-vrf-sub.js <subscriptionId>");
  console.log("========================================");
}

main().catch((err) => {
  console.error("FAILED:", err.shortMessage || err.message || err);
  process.exit(1);
});
