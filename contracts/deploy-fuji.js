const { createPublicClient, createWalletClient, http, encodePacked, encodeAbiParameters, parseAbiParameters, formatEther, parseEther, zeroAddress, encodeFunctionData, decodeFunctionResult, keccak256, toHex, erc20Abi } = require("viem");
const { avalancheFuji } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const WAVAX_FUJI = "0xd00ae08403B9bbb9124bB305C09058E32C39A48c";
const VRF_COORDINATOR_FUJI = "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE";
const VRF_WRAPPER_FUJI = "0x327B83F409E1D5f13985c6d0584420FA648f1F56";
const VRF_KEYHASH_FUJI = "0xc799bd1e3bd4d1a41cd4968997a4e03dfd2a3c7c04b695881138580163f42887";
const LINK_FUJI = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";

const BANK_SEED_LINK = parseEther("10"); // seed bank with 10 LINK
const HOUSE_EDGE_BP = 400; // 4%
const BALANCE_RISK_BP = 200; // 2%
const REFUND_TIME = 86400n; // 24h
const MAX_CALL_GAS = 30000n;
const VRF_CALLBACK_GAS_BASE = 294000;
const VRF_CALLBACK_GAS_EXTRA_BET = 2000;
const VRF_REQUEST_CONFIRMATIONS = 1;

const sdk = require("@betswirl/sdk-core");
const bankAbi = sdk.bankAbi;
const coinTossAbi = sdk.coinTossAbi;

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("Set DEPLOYER_PRIVATE_KEY in contracts/.env");

  const account = privateKeyToAccount(pk);
  console.log("Deployer:", account.address);

  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: avalancheFuji, transport: http(RPC), account });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("AVAX Balance:", formatEther(balance), "AVAX");

  const linkBalance = await publicClient.readContract({
    address: LINK_FUJI, abi: erc20Abi, functionName: "balanceOf", args: [account.address],
  });
  console.log("LINK Balance:", formatEther(linkBalance), "LINK");

  if (balance < parseEther("0.3")) {
    console.error("Need at least 0.3 AVAX for gas. Fund", account.address);
    process.exit(1);
  }
  if (linkBalance < BANK_SEED_LINK) {
    console.error("Need at least", formatEther(BANK_SEED_LINK), "LINK for bank liquidity. Fund", account.address);
    process.exit(1);
  }

  // --- STEP 1: Deploy Bank ---
  console.log("\n=== Deploying Bank ===");
  const bankBytecode = fs.readFileSync(path.join(__dirname, "bank-bytecode.txt"), "utf8").trim();
  const bankConstructorArgs = encodeAbiParameters(
    parseAbiParameters("address, address, address, uint256"),
    [account.address, account.address, WAVAX_FUJI, MAX_CALL_GAS]
  );

  const bankDeployHash = await walletClient.sendTransaction({
    data: (bankBytecode + bankConstructorArgs.slice(2)),
    gas: 4_000_000n,
  });
  console.log("Bank deploy tx:", bankDeployHash);
  const bankReceipt = await publicClient.waitForTransactionReceipt({ hash: bankDeployHash });
  const bankAddress = bankReceipt.contractAddress;
  console.log("Bank deployed at:", bankAddress);
  if (!bankAddress) throw new Error("Bank deployment failed");

  // --- STEP 2: Deploy CoinToss ---
  console.log("\n=== Deploying CoinToss ===");
  const ctBytecode = fs.readFileSync(path.join(__dirname, "cointoss-bytecode.txt"), "utf8").trim();
  const ctConstructorArgs = encodeAbiParameters(
    parseAbiParameters("address, address, address, address, uint64, uint256"),
    [bankAddress, VRF_COORDINATOR_FUJI, VRF_WRAPPER_FUJI, WAVAX_FUJI, REFUND_TIME, MAX_CALL_GAS]
  );

  const ctDeployHash = await walletClient.sendTransaction({
    data: (ctBytecode + ctConstructorArgs.slice(2)),
    gas: 4_000_000n,
  });
  console.log("CoinToss deploy tx:", ctDeployHash);
  const ctReceipt = await publicClient.waitForTransactionReceipt({ hash: ctDeployHash });
  const coinTossAddress = ctReceipt.contractAddress;
  console.log("CoinToss deployed at:", coinTossAddress);
  if (!coinTossAddress) throw new Error("CoinToss deployment failed");

  // --- STEP 3: Configure Bank ---
  console.log("\n=== Configuring Bank ===");

  // 3a. Get GAME_ROLE hash
  const gameRoleData = encodeFunctionData({ abi: bankAbi, functionName: "GAME_ROLE", args: [] });
  const gameRoleResult = await publicClient.call({ to: bankAddress, data: gameRoleData });
  const gameRole = decodeFunctionResult({ abi: bankAbi, functionName: "GAME_ROLE", data: gameRoleResult.data });
  console.log("GAME_ROLE:", gameRole);

  // 3b. Grant GAME_ROLE to CoinToss
  console.log("Granting GAME_ROLE to CoinToss...");
  const grantHash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "grantRole",
    args: [gameRole, coinTossAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: grantHash });
  console.log("  done:", grantHash);

  // 3c. Add LINK token
  console.log("Adding LINK token...");
  const addTokenHash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "addToken",
    args: [LINK_FUJI, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: addTokenHash });
  console.log("  done:", addTokenHash);

  // 3d. Allow LINK for betting
  console.log("Allowing LINK for betting...");
  const allowHash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setAllowedToken",
    args: [LINK_FUJI, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: allowHash });
  console.log("  done:", allowHash);

  // 3e. Set balance risk
  console.log("Setting balance risk to", BALANCE_RISK_BP, "BP...");
  const riskHash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setBalanceRisk",
    args: [LINK_FUJI, BALANCE_RISK_BP],
  });
  await publicClient.waitForTransactionReceipt({ hash: riskHash });
  console.log("  done:", riskHash);

  // 3f. Set house edge split (bank 20%, dividend 30%, affiliate 30%, treasury 10%, team 10%)
  console.log("Setting house edge split...");
  const splitHash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setHouseEdgeSplit",
    args: [LINK_FUJI, 2000, 3000, 3000, 1000, 1000],
  });
  await publicClient.waitForTransactionReceipt({ hash: splitHash });
  console.log("  done:", splitHash);

  // 3g. Unpause LINK token
  console.log("Unpausing LINK token...");
  const unpauseHash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setPausedToken",
    args: [LINK_FUJI, false],
  });
  await publicClient.waitForTransactionReceipt({ hash: unpauseHash });
  console.log("  done:", unpauseHash);

  // 3h. Approve Bank to spend our LINK
  console.log("Approving Bank to spend LINK...");
  const approveHash = await walletClient.writeContract({
    address: LINK_FUJI, abi: erc20Abi, functionName: "approve",
    args: [bankAddress, BANK_SEED_LINK],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("  done:", approveHash);

  // 3i. Deposit LINK as bank liquidity
  console.log("Depositing", formatEther(BANK_SEED_LINK), "LINK as bank liquidity...");
  const depositHash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "deposit",
    args: [LINK_FUJI, BANK_SEED_LINK],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  console.log("  done:", depositHash);

  // --- STEP 4: Configure CoinToss ---
  console.log("\n=== Configuring CoinToss ===");

  // 4a. Set Chainlink config
  console.log("Setting Chainlink VRF config...");
  const chainlinkHash = await walletClient.writeContract({
    address: coinTossAddress, abi: coinTossAbi, functionName: "setChainlinkConfig",
    args: [VRF_REQUEST_CONFIRMATIONS, VRF_KEYHASH_FUJI, VRF_WRAPPER_FUJI, VRF_CALLBACK_GAS_EXTRA_BET, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: chainlinkHash });
  console.log("  done:", chainlinkHash);

  // 4b. Set house edge for LINK token
  console.log("Setting house edge to", HOUSE_EDGE_BP, "BP (", HOUSE_EDGE_BP / 100, "%)...");
  const edgeHash = await walletClient.writeContract({
    address: coinTossAddress, abi: coinTossAbi, functionName: "setHouseEdge",
    args: [LINK_FUJI, HOUSE_EDGE_BP],
  });
  await publicClient.waitForTransactionReceipt({ hash: edgeHash });
  console.log("  done:", edgeHash);

  // 4c. Set VRF callback gas base for LINK token
  console.log("Setting VRF callback gas base to", VRF_CALLBACK_GAS_BASE, "...");
  const gasBaseHash = await walletClient.writeContract({
    address: coinTossAddress, abi: coinTossAbi, functionName: "setVRFCallbackGasBase",
    args: [LINK_FUJI, VRF_CALLBACK_GAS_BASE],
  });
  await publicClient.waitForTransactionReceipt({ hash: gasBaseHash });
  console.log("  done:", gasBaseHash);

  // --- SUMMARY ---
  console.log("\n========================================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Bank:     ", bankAddress);
  console.log("CoinToss: ", coinTossAddress);
  console.log("Network:   Avalanche Fuji (43113)");
  console.log("========================================");
  console.log("\nMANUAL STEPS REMAINING:");
  console.log("1. Create VRF subscription at https://vrf.chain.link/fuji");
  console.log("2. Fund subscription with LINK");
  console.log("3. Add CoinToss as consumer:", coinTossAddress);
  console.log("4. Then run: node contracts/set-vrf-sub.js <subscriptionId>");
  console.log("========================================");

  // Save deployment info
  const deployInfo = {
    network: "avalanche-fuji",
    chainId: 43113,
    deployer: account.address,
    bank: bankAddress,
    coinToss: coinTossAddress,
    betToken: LINK_FUJI,
    betTokenSymbol: "LINK",
    vrfCoordinator: VRF_COORDINATOR_FUJI,
    vrfWrapper: VRF_WRAPPER_FUJI,
    wavax: WAVAX_FUJI,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "deployment-fuji.json"), JSON.stringify(deployInfo, null, 2));
  console.log("\nSaved deployment info to contracts/deployment-fuji.json");
}

main().catch((err) => {
  console.error("DEPLOYMENT FAILED:", err);
  process.exit(1);
});
