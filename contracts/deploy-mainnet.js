const {
  createPublicClient, createWalletClient, http, encodeAbiParameters,
  parseAbiParameters, formatEther, parseEther, zeroAddress,
  encodeFunctionData, decodeFunctionResult,
} = require("viem");
const { avalanche } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const RPC = "https://api.avax.network/ext/bc/C/rpc";
const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const VRF_COORDINATOR = "0xE40895D055bccd2053dD0638C9695E326152b1A4";
const VRF_WRAPPER = "0x62Fb87c10A917580cA99AB9a86E213Eb98aa820C";
const VRF_KEYHASH = "0x84213dcadf1f89e4097eb654e3f284d7d5d5bda2bd4748d8b7fada5b3a6eaa0d";

const AVAX_TOKEN = zeroAddress; // native AVAX = zero address
const INITIAL_LIQUIDITY = parseEther("1"); // 1 AVAX initial deposit
const HOUSE_EDGE_BP = 400; // 4%
const BALANCE_RISK_BP = 200; // 2% of liquidity per bet
const REFUND_TIME = 86400n; // 24h
const MAX_CALL_GAS = 30000n;
const VRF_CALLBACK_GAS_BASE = 294000;
const VRF_CALLBACK_GAS_EXTRA_BET = 2000;
const VRF_REQUEST_CONFIRMATIONS = 0; // Avalanche mainnet allows 0

const sdk = require("@betswirl/sdk-core");
const bankAbi = sdk.bankAbi;
const coinTossAbi = sdk.coinTossAbi;

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("Set DEPLOYER_PRIVATE_KEY in contracts/.env");

  const account = privateKeyToAccount(pk);
  console.log("Deployer:", account.address);
  console.log("Network:  Avalanche Mainnet (43114)");
  console.log("=========================================\n");

  const publicClient = createPublicClient({ chain: avalanche, transport: http(RPC) });
  const walletClient = createWalletClient({ chain: avalanche, transport: http(RPC), account });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("AVAX Balance:", formatEther(balance), "AVAX");

  const minRequired = parseEther("1.5"); // 1 AVAX liquidity + ~0.5 gas
  if (balance < minRequired) {
    console.error("Need at least 1.5 AVAX (1 liquidity + 0.5 gas). Fund", account.address);
    process.exit(1);
  }

  // --- STEP 1: Deploy Bank ---
  console.log("\n=== Step 1: Deploying Bank ===");
  const bankBytecode = fs.readFileSync(path.join(__dirname, "bank-bytecode.txt"), "utf8").trim();
  const bankConstructorArgs = encodeAbiParameters(
    parseAbiParameters("address, address, address, uint256"),
    [account.address, account.address, WAVAX, MAX_CALL_GAS]
  );

  const bankDeployHash = await walletClient.sendTransaction({
    data: (bankBytecode + bankConstructorArgs.slice(2)),
    gas: 6_000_000n,
  });
  console.log("Bank deploy tx:", bankDeployHash);
  const bankReceipt = await publicClient.waitForTransactionReceipt({ hash: bankDeployHash });
  const bankAddress = bankReceipt.contractAddress;

  if (!bankAddress || bankReceipt.status === "reverted") {
    throw new Error("Bank deployment FAILED. Check gas and balance.");
  }
  const bankCode = await publicClient.getCode({ address: bankAddress });
  if (!bankCode || bankCode.length <= 2) {
    throw new Error("Bank deployed but has NO CODE. Likely out-of-gas.");
  }
  console.log("Bank deployed at:", bankAddress);
  console.log("Gas used:", bankReceipt.gasUsed.toString());

  // --- STEP 2: Deploy CoinToss ---
  console.log("\n=== Step 2: Deploying CoinToss ===");
  const ctBytecode = fs.readFileSync(path.join(__dirname, "cointoss-bytecode.txt"), "utf8").trim();
  const ctConstructorArgs = encodeAbiParameters(
    parseAbiParameters("address, address, address, address, uint64, uint256"),
    [bankAddress, VRF_COORDINATOR, VRF_WRAPPER, WAVAX, REFUND_TIME, MAX_CALL_GAS]
  );

  const ctDeployHash = await walletClient.sendTransaction({
    data: (ctBytecode + ctConstructorArgs.slice(2)),
    gas: 8_000_000n,
  });
  console.log("CoinToss deploy tx:", ctDeployHash);
  const ctReceipt = await publicClient.waitForTransactionReceipt({ hash: ctDeployHash });
  const coinTossAddress = ctReceipt.contractAddress;

  if (!coinTossAddress || ctReceipt.status === "reverted") {
    throw new Error("CoinToss deployment FAILED. Check gas and balance.");
  }
  const ctCode = await publicClient.getCode({ address: coinTossAddress });
  if (!ctCode || ctCode.length <= 2) {
    throw new Error("CoinToss deployed but has NO CODE. Likely out-of-gas.");
  }
  console.log("CoinToss deployed at:", coinTossAddress);
  console.log("Gas used:", ctReceipt.gasUsed.toString());

  // --- STEP 3: Configure Bank ---
  console.log("\n=== Step 3: Configuring Bank ===");

  const gameRoleData = encodeFunctionData({ abi: bankAbi, functionName: "GAME_ROLE", args: [] });
  const gameRoleResult = await publicClient.call({ to: bankAddress, data: gameRoleData });
  const gameRole = decodeFunctionResult({ abi: bankAbi, functionName: "GAME_ROLE", data: gameRoleResult.data });

  console.log("3a. Granting GAME_ROLE to CoinToss...");
  let hash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "grantRole",
    args: [gameRole, coinTossAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("3b. Adding native AVAX token...");
  hash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "addToken",
    args: [AVAX_TOKEN, false],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("3c. Allowing AVAX for betting...");
  hash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setAllowedToken",
    args: [AVAX_TOKEN, true],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("3d. Setting balance risk to", BALANCE_RISK_BP, "BP (2%)...");
  hash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setBalanceRisk",
    args: [AVAX_TOKEN, BALANCE_RISK_BP],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("3e. Setting house edge split (20/30/30/10/10)...");
  hash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setHouseEdgeSplit",
    args: [AVAX_TOKEN, 2000, 3000, 3000, 1000, 1000],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("3f. Unpausing AVAX token...");
  hash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "setPausedToken",
    args: [AVAX_TOKEN, false],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("3g. Depositing", formatEther(INITIAL_LIQUIDITY), "AVAX as bank liquidity...");
  hash = await walletClient.writeContract({
    address: bankAddress, abi: bankAbi, functionName: "deposit",
    args: [AVAX_TOKEN, INITIAL_LIQUIDITY],
    value: INITIAL_LIQUIDITY,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  // --- STEP 4: Configure CoinToss ---
  console.log("\n=== Step 4: Configuring CoinToss ===");

  console.log("4a. Setting Chainlink VRF config (nativePayment=false, pays LINK)...");
  hash = await walletClient.writeContract({
    address: coinTossAddress, abi: coinTossAbi, functionName: "setChainlinkConfig",
    args: [VRF_REQUEST_CONFIRMATIONS, VRF_KEYHASH, VRF_WRAPPER, VRF_CALLBACK_GAS_EXTRA_BET, false],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("4b. Setting house edge to", HOUSE_EDGE_BP, "BP (4%)...");
  hash = await walletClient.writeContract({
    address: coinTossAddress, abi: coinTossAbi, functionName: "setHouseEdge",
    args: [AVAX_TOKEN, HOUSE_EDGE_BP],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  console.log("4c. Setting VRF callback gas base...");
  hash = await walletClient.writeContract({
    address: coinTossAddress, abi: coinTossAbi, functionName: "setVRFCallbackGasBase",
    args: [AVAX_TOKEN, VRF_CALLBACK_GAS_BASE],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("  done:", hash);

  // --- SUMMARY ---
  console.log("\n=========================================");
  console.log("  DEPLOYMENT COMPLETE!");
  console.log("=========================================");
  console.log("Bank:      ", bankAddress);
  console.log("CoinToss:  ", coinTossAddress);
  console.log("Network:    Avalanche Mainnet (43114)");
  console.log("Bet token:  AVAX (native)");
  console.log("Liquidity:  " + formatEther(INITIAL_LIQUIDITY) + " AVAX");
  console.log("House edge: 4%");
  console.log("=========================================");
  console.log("\nMANUAL STEPS REMAINING:");
  console.log("1. Go to https://vrf.chain.link/avalanche");
  console.log("2. Create a subscription & fund with 5 LINK");
  console.log("3. Add CoinToss as consumer:", coinTossAddress);
  console.log("4. Run: node contracts/set-vrf-sub-mainnet.js <subscriptionId>");
  console.log("5. Test: node contracts/test-bet-mainnet.js");
  console.log("=========================================");

  const deployInfo = {
    network: "avalanche-mainnet",
    chainId: 43114,
    deployer: account.address,
    bank: bankAddress,
    coinToss: coinTossAddress,
    betToken: AVAX_TOKEN,
    betTokenSymbol: "AVAX",
    vrfCoordinator: VRF_COORDINATOR,
    vrfWrapper: VRF_WRAPPER,
    wavax: WAVAX,
    initialLiquidity: formatEther(INITIAL_LIQUIDITY),
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "deployment-mainnet.json"), JSON.stringify(deployInfo, null, 2));
  console.log("\nSaved to contracts/deployment-mainnet.json");
}

main().catch((err) => {
  console.error("\nDEPLOYMENT FAILED:", err.shortMessage || err.message || err);
  process.exit(1);
});
