// Run with: node contracts/remix/base/build-base-scripts.js
// Generates all Base Remix IDE scripts with bytecodes inline.
const fs = require("fs");
const path = require("path");

const contractsDir = path.resolve(__dirname, "../..");
const outDir = __dirname;

const bankBytecode = fs.readFileSync(path.join(contractsDir, "bank-bytecode.txt"), "utf8").trim();
const coinBytecode = fs.readFileSync(path.join(contractsDir, "cointoss-bytecode.txt"), "utf8").trim();
let weightedBytecode = fs.readFileSync(path.join(contractsDir, "weighted-bytecode.txt"), "utf8").trim();
if (!weightedBytecode.startsWith("0x")) weightedBytecode = "0x" + weightedBytecode;

console.log("Bank bytecode:", bankBytecode.length, "chars");
console.log("CoinToss bytecode:", coinBytecode.length, "chars");
console.log("WeightedGame bytecode:", weightedBytecode.length, "chars");

// ======== BASE ADDRESSES ========
const WETH = "0x4200000000000000000000000000000000000006";
const VRF_COORDINATOR = "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634";
const VRF_WRAPPER = "0xb0407dbe851f8318bd31404a49e658143c982f23";
const VRF_KEYHASH = "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70";
const GAME_ROLE = "0x6a64baf327d646d1bca72653e2a075d15fd6ac6d8cbd7f6ee03fc55875e0fa88";

// ======== SCRIPT 1: DEPLOY BANK ========
fs.writeFileSync(path.join(outDir, "1_deploy_bank.js"), `// BASE — Step 1: Deploy Bank
// Remix IDE > right-click > Run. MetaMask must be on Base mainnet (8453).
// VERIFY deployer address in console matches your MetaMask wallet!

(async () => {
  const WETH = "${WETH}";
  const MAX_CALL_GAS = 30000;

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Chain: Base (8453)");

  const constructorArgs = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address', 'uint256'],
    [deployer, deployer, WETH, MAX_CALL_GAS]
  ).slice(2);

  const bytecode = "${bankBytecode}";
  console.log("Bytecode length:", bytecode.length, "(should be ${bankBytecode.length})");
  if (bytecode.length !== ${bankBytecode.length}) { console.log("ERROR: bytecode truncated!"); return; }

  console.log("Deploying Bank... confirm in MetaMask (gas ~6M)");
  const receipt = await web3.eth.sendTransaction({
    from: deployer,
    data: bytecode + constructorArgs,
    gas: 6000000,
  });

  console.log("=== BANK DEPLOYED ===");
  console.log("Address:", receipt.contractAddress);
  console.log("Tx hash:", receipt.transactionHash);
  console.log("Gas used:", receipt.gasUsed);
  console.log("");
  console.log("SAVE THIS ADDRESS — paste it into scripts 2a, 2b, 3, 5, 6, 7.");
})();
`);

// ======== SCRIPT 2A: DEPLOY COINTOSS ========
fs.writeFileSync(path.join(outDir, "2a_deploy_cointoss.js"), `// BASE — Step 2a: Deploy CoinToss
// PASTE your Bank address from Step 1 below!

(async () => {
  // ===== PASTE YOUR BANK ADDRESS HERE =====
  const BANK_ADDRESS = "PASTE_BANK_ADDRESS_HERE";
  // =========================================

  if (BANK_ADDRESS.includes("PASTE")) { console.log("ERROR: paste your Bank address first!"); return; }

  const VRF_COORDINATOR = "${VRF_COORDINATOR}";
  const VRF_WRAPPER = "${VRF_WRAPPER}";
  const WETH = "${WETH}";
  const REFUND_TIME = 86400;
  const MAX_CALL_GAS = 30000;

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  const constructorArgs = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address', 'address', 'uint64', 'uint256'],
    [BANK_ADDRESS, VRF_COORDINATOR, VRF_WRAPPER, WETH, REFUND_TIME, MAX_CALL_GAS]
  ).slice(2);

  const bytecode = "${coinBytecode}";
  console.log("Bytecode length:", bytecode.length, "(should be ${coinBytecode.length})");
  if (bytecode.length !== ${coinBytecode.length}) { console.log("ERROR: bytecode truncated!"); return; }

  console.log("Deploying CoinToss... confirm in MetaMask (gas ~8M)");
  const receipt = await web3.eth.sendTransaction({
    from: deployer,
    data: bytecode + constructorArgs,
    gas: 8000000,
  });

  console.log("=== COINTOSS DEPLOYED ===");
  console.log("Address:", receipt.contractAddress);
  console.log("Tx hash:", receipt.transactionHash);
  console.log("Gas used:", receipt.gasUsed);
  console.log("");
  console.log("SAVE THIS ADDRESS — paste it into scripts 3, 4, 6, 7.");
})();
`);

// ======== SCRIPT 2B: DEPLOY WEIGHTEDGAME ========
fs.writeFileSync(path.join(outDir, "2b_deploy_weighted.js"), `// BASE — Step 2b: Deploy WeightedGame (covers Wheel + Plinko)
// PASTE your Bank address from Step 1 below!

(async () => {
  // ===== PASTE YOUR BANK ADDRESS HERE =====
  const BANK_ADDRESS = "PASTE_BANK_ADDRESS_HERE";
  // =========================================

  if (BANK_ADDRESS.includes("PASTE")) { console.log("ERROR: paste your Bank address first!"); return; }

  const VRF_COORDINATOR = "${VRF_COORDINATOR}";
  const VRF_WRAPPER = "${VRF_WRAPPER}";
  const WETH = "${WETH}";
  const REFUND_TIME = 86400;
  const MAX_CALL_GAS = 30000;
  const NUM_RANDOM_WORDS = 31; // max configs per WeightedGame

  // WeightedGame has 7 constructor params (same 6 as CoinToss + numRandomWords as uint8 at the end)
  const constructorArgs = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address', 'address', 'uint64', 'uint256', 'uint8'],
    [BANK_ADDRESS, VRF_COORDINATOR, VRF_WRAPPER, WETH, REFUND_TIME, MAX_CALL_GAS, NUM_RANDOM_WORDS]
  ).slice(2);

  const bytecode = "${weightedBytecode}";
  console.log("Bytecode length:", bytecode.length, "(should be ${weightedBytecode.length})");
  if (bytecode.length !== ${weightedBytecode.length}) { console.log("ERROR: bytecode truncated!"); return; }

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Deploying WeightedGame... confirm in MetaMask (gas ~12M)");
  const receipt = await web3.eth.sendTransaction({
    from: deployer,
    data: bytecode + constructorArgs,
    gas: 12000000,
  });

  console.log("=== WEIGHTEDGAME DEPLOYED ===");
  console.log("Address:", receipt.contractAddress);
  console.log("Tx hash:", receipt.transactionHash);
  console.log("Gas used:", receipt.gasUsed);
  console.log("");
  console.log("SAVE THIS ADDRESS — paste it into scripts 3, 4, 6.");
  console.log("This single contract handles Wheel AND Plinko (different configIds).");
})();
`);

// ======== SCRIPT 3: CONFIGURE ALL ========
fs.writeFileSync(path.join(outDir, "3_configure_all.js"), `// BASE — Step 3: Configure Bank + CoinToss + WeightedGame
// This script does ALL post-deploy configuration in one go.
// Each tx pops MetaMask — confirm each in sequence.

(async () => {
  // ===== PASTE YOUR ADDRESSES HERE =====
  const BANK      = "PASTE_BANK_ADDRESS_HERE";
  const COINTOSS  = "PASTE_COINTOSS_ADDRESS_HERE";
  const WEIGHTED  = "PASTE_WEIGHTED_ADDRESS_HERE";
  // ======================================

  if (BANK.includes("PASTE") || COINTOSS.includes("PASTE") || WEIGHTED.includes("PASTE")) {
    console.log("ERROR: paste all 3 contract addresses first!"); return;
  }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const VRF_KEYHASH = "${VRF_KEYHASH}";
  const VRF_WRAPPER = "${VRF_WRAPPER}";
  const GAME_ROLE = "${GAME_ROLE}";

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Bank:", BANK);
  console.log("CoinToss:", COINTOSS);
  console.log("WeightedGame:", WEIGHTED);

  let step = 0;
  const total = 14;
  function log(msg) { step++; console.log(step + "/" + total + " " + msg); }

  try {
    // --- BANK: Grant game roles ---
    log("Bank.grantRole(GAME_ROLE, CoinToss)");
    await web3.eth.sendTransaction({ from: deployer, to: BANK, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "grantRole", type: "function",
        inputs: [{ type: "bytes32", name: "role" }, { type: "address", name: "account" }]
      }, [GAME_ROLE, COINTOSS]) });

    log("Bank.grantRole(GAME_ROLE, WeightedGame)");
    await web3.eth.sendTransaction({ from: deployer, to: BANK, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "grantRole", type: "function",
        inputs: [{ type: "bytes32", name: "role" }, { type: "address", name: "account" }]
      }, [GAME_ROLE, WEIGHTED]) });

    // --- BANK: Add ETH (native) as bet token ---
    log("Bank.addToken(ETH, true)");
    await web3.eth.sendTransaction({ from: deployer, to: BANK, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "addToken", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "bool", name: "_added" }]
      }, [ZERO, true]) });

    log("Bank.setAllowedToken(ETH, true)");
    await web3.eth.sendTransaction({ from: deployer, to: BANK, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setAllowedToken", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "bool", name: "_allowed" }]
      }, [ZERO, true]) });

    log("Bank.setBalanceRisk(ETH, 200)  // 2%");
    await web3.eth.sendTransaction({ from: deployer, to: BANK, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setBalanceRisk", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "uint16", name: "_balanceRisk" }]
      }, [ZERO, 200]) });

    log("Bank.setHouseEdgeSplit(ETH, 2000/3000/3000/1000/1000)");
    await web3.eth.sendTransaction({ from: deployer, to: BANK, gas: 200000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setHouseEdgeSplit", type: "function",
        inputs: [
          { type: "address", name: "_token" },
          { type: "uint16", name: "_bank" }, { type: "uint16", name: "_dividend" },
          { type: "uint16", name: "_referral" }, { type: "uint16", name: "_treasury" },
          { type: "uint16", name: "_team" }
        ]
      }, [ZERO, 2000, 3000, 3000, 1000, 1000]) });

    log("Bank.setPausedToken(ETH, false)");
    await web3.eth.sendTransaction({ from: deployer, to: BANK, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setPausedToken", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "bool", name: "_paused" }]
      }, [ZERO, false]) });

    // --- COINTOSS CONFIG ---
    // NOTE: setChainlinkConfig 4th param is uint32 (NOT uint16). Wrong type = selector mismatch revert.
    log("CoinToss.setChainlinkConfig(3, keyHash, wrapper, 2000, false)");
    await web3.eth.sendTransaction({ from: deployer, to: COINTOSS, gas: 200000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setChainlinkConfig", type: "function",
        inputs: [
          { type: "uint16", name: "_requestConfirmations" },
          { type: "bytes32", name: "_keyHash" },
          { type: "address", name: "_wrapper" },
          { type: "uint32", name: "_callbackGasExtraBet" },
          { type: "bool", name: "_nativePayment" }
        ]
      }, [3, VRF_KEYHASH, VRF_WRAPPER, 2000, false]) });

    log("CoinToss.setHouseEdge(ETH, 400)  // 4%");
    await web3.eth.sendTransaction({ from: deployer, to: COINTOSS, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setHouseEdge", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "uint16", name: "_houseEdge" }]
      }, [ZERO, 400]) });

    // NOTE: 2nd param is uint32 (NOT uint256). Wrong type = selector mismatch revert.
    log("CoinToss.setVRFCallbackGasBase(ETH, 294000)");
    await web3.eth.sendTransaction({ from: deployer, to: COINTOSS, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setVRFCallbackGasBase", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "uint32", name: "_callbackGasBase" }]
      }, [ZERO, 294000]) });

    // --- WEIGHTEDGAME CONFIG ---
    log("WeightedGame.setChainlinkConfig(3, keyHash, wrapper, 2000, false)");
    await web3.eth.sendTransaction({ from: deployer, to: WEIGHTED, gas: 200000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setChainlinkConfig", type: "function",
        inputs: [
          { type: "uint16", name: "_requestConfirmations" },
          { type: "bytes32", name: "_keyHash" },
          { type: "address", name: "_wrapper" },
          { type: "uint32", name: "_callbackGasExtraBet" },
          { type: "bool", name: "_nativePayment" }
        ]
      }, [3, VRF_KEYHASH, VRF_WRAPPER, 2000, false]) });

    log("WeightedGame.setHouseEdge(ETH, 400)  // 4%");
    await web3.eth.sendTransaction({ from: deployer, to: WEIGHTED, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setHouseEdge", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "uint16", name: "_houseEdge" }]
      }, [ZERO, 400]) });

    log("WeightedGame.setVRFCallbackGasBase(ETH, 294000)");
    await web3.eth.sendTransaction({ from: deployer, to: WEIGHTED, gas: 100000,
      data: web3.eth.abi.encodeFunctionCall({ name: "setVRFCallbackGasBase", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "uint32", name: "_callbackGasBase" }]
      }, [ZERO, 294000]) });

    console.log("\\n=========================================");
    console.log("  ALL " + total + " CONFIG TXS DONE!");
    console.log("=========================================");
    console.log("Next steps:");
    console.log("1. Go to https://vrf.chain.link/base");
    console.log("2. Create subscription, fund with ~5 LINK");
    console.log("3. Add BOTH consumers: " + COINTOSS + " and " + WEIGHTED);
    console.log("4. Copy subscription ID, paste into script 4");
  } catch (err) {
    console.log("FAILED at step " + step + ":", err.message || err);
  }
})();
`);

// ======== SCRIPT 4: SET VRF SUB ID ========
fs.writeFileSync(path.join(outDir, "4_set_vrf_sub.js"), `// BASE — Step 4: Set VRF Subscription ID on BOTH games
// Run AFTER creating subscription at https://vrf.chain.link/base

(async () => {
  // ===== PASTE YOUR ADDRESSES + VRF SUB ID HERE =====
  const COINTOSS = "PASTE_COINTOSS_ADDRESS_HERE";
  const WEIGHTED = "PASTE_WEIGHTED_ADDRESS_HERE";
  const VRF_SUB_ID = "PASTE_VRF_SUBSCRIPTION_ID_HERE";
  // ===================================================

  if (COINTOSS.includes("PASTE") || WEIGHTED.includes("PASTE") || VRF_SUB_ID.includes("PASTE")) {
    console.log("ERROR: paste addresses and VRF sub ID first!"); return;
  }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  const encode = (token, subId) => web3.eth.abi.encodeFunctionCall({
    name: "setVRFSubId", type: "function",
    inputs: [{ type: "address", name: "_token" }, { type: "uint256", name: "_vrfSubId" }]
  }, [token, subId]);

  try {
    console.log("1/2 Setting VRF sub on CoinToss...");
    await web3.eth.sendTransaction({ from: deployer, to: COINTOSS, data: encode(ZERO, VRF_SUB_ID), gas: 100000 });
    console.log("  done!");

    console.log("2/2 Setting VRF sub on WeightedGame...");
    await web3.eth.sendTransaction({ from: deployer, to: WEIGHTED, data: encode(ZERO, VRF_SUB_ID), gas: 100000 });
    console.log("  done!");

    console.log("\\nBoth games configured! Next: run script 5 to deposit liquidity.");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
`);

// ======== SCRIPT 5: DEPOSIT LIQUIDITY ========
fs.writeFileSync(path.join(outDir, "5_deposit_liquidity.js"), `// BASE — Step 5: Deposit ETH liquidity to the Bank

(async () => {
  // ===== PASTE YOUR BANK ADDRESS + AMOUNT =====
  const BANK = "PASTE_BANK_ADDRESS_HERE";
  const DEPOSIT_ETH = "0.02"; // Start small for testing
  // =============================================

  if (BANK.includes("PASTE")) { console.log("ERROR: paste Bank address first!"); return; }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const depositWei = web3.utils.toWei(DEPOSIT_ETH, "ether");
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Depositing", DEPOSIT_ETH, "ETH to Bank...");

  try {
    const receipt = await web3.eth.sendTransaction({
      from: deployer, to: BANK, gas: 200000, value: depositWei,
      data: web3.eth.abi.encodeFunctionCall({ name: "deposit", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "uint256", name: "_amount" }]
      }, [ZERO, depositWei])
    });
    console.log("Done! Tx:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed);
    console.log("\\nMax bet (CoinToss 2x, 2% risk): ~" + (parseFloat(DEPOSIT_ETH) * 0.01).toFixed(6) + " ETH");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
`);

// ======== SCRIPT 6: DIAGNOSE ========
fs.writeFileSync(path.join(outDir, "6_diagnose.js"), `// BASE — Diagnose: Read state of all contracts

(async () => {
  // ===== PASTE YOUR ADDRESSES HERE =====
  const BANK     = "PASTE_BANK_ADDRESS_HERE";
  const COINTOSS = "PASTE_COINTOSS_ADDRESS_HERE";
  const WEIGHTED = "PASTE_WEIGHTED_ADDRESS_HERE";
  // ======================================

  const ZERO = "0x0000000000000000000000000000000000000000";
  const accounts = await web3.eth.getAccounts();
  console.log("Caller:", accounts[0]);

  const gasPrice = await web3.eth.getGasPrice();
  console.log("Gas price:", gasPrice, "wei (" + (parseInt(gasPrice) / 1e9).toFixed(4) + " gwei)");

  const call = async (to, name, inputs, args) => {
    const data = web3.eth.abi.encodeFunctionCall({ name, type: "function", inputs }, args || []);
    return web3.eth.call({ to, data, gasPrice });
  };

  try {
    if (!BANK.includes("PASTE")) {
      console.log("\\n--- BANK ---");
      const bal = web3.eth.abi.decodeParameter("uint256", await call(BANK, "getBalance",
        [{ type: "address", name: "token" }], [ZERO]));
      console.log("ETH balance:", web3.utils.fromWei(bal, "ether"), "ETH");

      const req = web3.eth.abi.decodeParameters(["bool","uint256","uint256"], await call(BANK, "getBetRequirements",
        [{ type: "address", name: "token" }, { type: "uint256", name: "multiplier" }], [ZERO, "20000"]));
      console.log("Token allowed:", req[0], "| Max bet:", web3.utils.fromWei(req[1], "ether"), "ETH | Max count:", req[2]);
    }

    const diagnoseGame = async (label, addr) => {
      if (addr.includes("PASTE")) return;
      console.log("\\n--- " + label + " ---");

      const tok = web3.eth.abi.decodeParameters(["uint16","uint64","uint256","uint32","uint256"],
        await call(addr, "tokens", [{ type: "address", name: "" }], [ZERO]));
      console.log("House edge:", tok[0], "BP | Pending:", tok[1], "| VRF Sub:", tok[2] !== "0" ? "SET" : "NOT SET",
        "| Gas base:", tok[3]);

      const paused = web3.eth.abi.decodeParameter("bool",
        await call(addr, "paused", []));
      console.log("Paused:", paused);

      try {
        const vrf = web3.eth.abi.decodeParameter("uint256",
          await web3.eth.call({ to: addr, gasPrice: "1000000000", gas: "500000",
            data: web3.eth.abi.encodeFunctionCall({ name: "getChainlinkVRFCost", type: "function",
              inputs: [{ type: "address", name: "token" }, { type: "uint16", name: "betCount" }]
            }, [ZERO, 1]) }));
        console.log("VRF cost (1gwei):", web3.utils.fromWei(vrf, "ether"), "ETH");
      } catch (e) { console.log("VRF cost: error -", e.message); }
    };

    await diagnoseGame("COINTOSS", COINTOSS);
    await diagnoseGame("WEIGHTEDGAME", WEIGHTED);

    console.log("\\n--- DONE ---");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
`);

// ======== SCRIPT 7: TEST BET ========
fs.writeFileSync(path.join(outDir, "7_test_bet.js"), `// BASE — Test bet on CoinToss (ETH, heads)
// Minimum bet to verify full VRF flow works.

(async () => {
  // ===== PASTE YOUR COINTOSS ADDRESS HERE =====
  const COINTOSS = "PASTE_COINTOSS_ADDRESS_HERE";
  // =============================================

  if (COINTOSS.includes("PASTE")) { console.log("ERROR: paste CoinToss address first!"); return; }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  try {
    // VRF cost at 1 gwei (safe floor)
    const vrfData = web3.eth.abi.encodeFunctionCall({
      name: "getChainlinkVRFCost", type: "function",
      inputs: [{ type: "address", name: "token" }, { type: "uint16", name: "betCount" }]
    }, [ZERO, 1]);
    const vrfResult = await web3.eth.call({ to: COINTOSS, data: vrfData, gasPrice: "1000000000", gas: "500000" });
    const vrfCost = BigInt(web3.eth.abi.decodeParameter("uint256", vrfResult));
    console.log("VRF cost:", (Number(vrfCost) / 1e18).toFixed(6), "ETH");

    // Use 3x VRF buffer as safety margin, min 0.0005 ETH
    const minVrf = BigInt("500000000000000"); // 0.0005 ETH
    const vrfBudget = vrfCost * 3n > minVrf ? vrfCost * 3n : minVrf;
    const betAmount = BigInt(web3.utils.toWei("0.001", "ether")); // tiny bet
    const totalValue = betAmount + vrfBudget;

    console.log("Bet: 0.001 ETH on HEADS");
    console.log("VRF budget:", (Number(vrfBudget) / 1e18).toFixed(6), "ETH");
    console.log("Total msg.value:", (Number(totalValue) / 1e18).toFixed(6), "ETH");

    const data = web3.eth.abi.encodeFunctionCall({
      name: "wager", type: "function",
      inputs: [
        { type: "bool", name: "face" },
        { type: "address", name: "receiver" },
        { type: "address", name: "affiliate" },
        { type: "tuple", name: "betData", components: [
          { type: "address", name: "token" }, { type: "uint256", name: "betAmount" },
          { type: "uint16", name: "betCount" }, { type: "uint256", name: "stopGain" },
          { type: "uint256", name: "stopLoss" }, { type: "uint16", name: "maxHouseEdge" }
        ]}
      ]
    }, [true, deployer, deployer, [ZERO, betAmount.toString(), 1, "0", "0", 3500]]);

    console.log("Sending wager... confirm in MetaMask");
    const receipt = await web3.eth.sendTransaction({
      from: deployer, to: COINTOSS, data: data,
      value: totalValue.toString(), gas: 500000
    });

    console.log("\\nBet placed! Tx:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed);
    console.log("Now wait ~5-30s for VRF callback.");
    console.log("Check basescan.org for Roll event on your address.");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
`);

console.log("\n✅ All 7 Base Remix scripts generated in", outDir);
console.log("Files created:");
["1_deploy_bank.js", "2a_deploy_cointoss.js", "2b_deploy_weighted.js",
 "3_configure_all.js", "4_set_vrf_sub.js", "5_deposit_liquidity.js",
 "6_diagnose.js", "7_test_bet.js"].forEach(f => console.log("  " + f));
