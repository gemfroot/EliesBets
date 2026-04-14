// BASE — Step 3: Configure Bank + CoinToss + WeightedGame
// Uses web3.eth.Contract pattern (same as working Avalanche script).
// Each tx pops MetaMask — confirm each in sequence.

(async () => {
  const BANK_ADDR = "0x076bcb7fbea47e4f4ea0bcd98b2f83317142ef96";
  const COINTOSS_ADDR = "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41";
  const WEIGHTED_ADDR = "0xD84179B7C51bDF6e3fF8A2bE21De6B1514334b23";

  const ZERO = "0x0000000000000000000000000000000000000000";
  const VRF_KEYHASH = "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70";
  const VRF_WRAPPER = "0xb0407dbe851f8318bd31404a49e658143c982f23";
  const GAME_ROLE = "0x6a64baf327d646d1bca72653e2a075d15fd6ac6d8cbd7f6ee03fc55875e0fa88";

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Bank:", BANK_ADDR);
  console.log("CoinToss:", COINTOSS_ADDR);
  console.log("WeightedGame:", WEIGHTED_ADDR);

  const bankAbi = [
    {"inputs":[{"name":"role","type":"bytes32"},{"name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_added","type":"bool"}],"name":"addToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_allowed","type":"bool"}],"name":"setAllowedToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_balanceRisk","type":"uint16"}],"name":"setBalanceRisk","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_bank","type":"uint16"},{"name":"_dividend","type":"uint16"},{"name":"_referral","type":"uint16"},{"name":"_treasury","type":"uint16"},{"name":"_team","type":"uint16"}],"name":"setHouseEdgeSplit","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_paused","type":"bool"}],"name":"setPausedToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
  ];

  const gameAbi = [
    {"inputs":[{"name":"_requestConfirmations","type":"uint16"},{"name":"_keyHash","type":"bytes32"},{"name":"_wrapper","type":"address"},{"name":"_callbackGasExtraBet","type":"uint32"},{"name":"_nativePayment","type":"bool"}],"name":"setChainlinkConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_houseEdge","type":"uint16"}],"name":"setHouseEdge","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_callbackGasBase","type":"uint32"}],"name":"setVRFCallbackGasBase","outputs":[],"stateMutability":"nonpayable","type":"function"},
  ];

  const bank = new web3.eth.Contract(bankAbi, BANK_ADDR);
  const coinToss = new web3.eth.Contract(gameAbi, COINTOSS_ADDR);
  const weighted = new web3.eth.Contract(gameAbi, WEIGHTED_ADDR);

  let step = 0;
  const total = 14;
  function log(msg) { step++; console.log(step + "/" + total + " " + msg); }

  try {
    log("Bank.grantRole(GAME_ROLE, CoinToss)");
    await bank.methods.grantRole(GAME_ROLE, COINTOSS_ADDR).send({ from: deployer });
    console.log("  done!");

    log("Bank.grantRole(GAME_ROLE, WeightedGame)");
    await bank.methods.grantRole(GAME_ROLE, WEIGHTED_ADDR).send({ from: deployer });
    console.log("  done!");

    log("Bank.addToken(ETH, true)");
    await bank.methods.addToken(ZERO, true).send({ from: deployer });
    console.log("  done!");

    log("Bank.setAllowedToken(ETH, true)");
    await bank.methods.setAllowedToken(ZERO, true).send({ from: deployer });
    console.log("  done!");

    log("Bank.setBalanceRisk(ETH, 200)  // 2%");
    await bank.methods.setBalanceRisk(ZERO, 200).send({ from: deployer });
    console.log("  done!");

    log("Bank.setHouseEdgeSplit(ETH, 2000/3000/3000/1000/1000)");
    await bank.methods.setHouseEdgeSplit(ZERO, 2000, 3000, 3000, 1000, 1000).send({ from: deployer });
    console.log("  done!");

    log("Bank.setPausedToken(ETH, false)");
    await bank.methods.setPausedToken(ZERO, false).send({ from: deployer });
    console.log("  done!");

    log("CoinToss.setChainlinkConfig(3, keyHash, wrapper, 2000, false)");
    await coinToss.methods.setChainlinkConfig(3, VRF_KEYHASH, VRF_WRAPPER, 2000, false).send({ from: deployer });
    console.log("  done!");

    log("CoinToss.setHouseEdge(ETH, 400)  // 4%");
    await coinToss.methods.setHouseEdge(ZERO, 400).send({ from: deployer });
    console.log("  done!");

    log("CoinToss.setVRFCallbackGasBase(ETH, 294000)");
    await coinToss.methods.setVRFCallbackGasBase(ZERO, 294000).send({ from: deployer });
    console.log("  done!");

    log("WeightedGame.setChainlinkConfig(3, keyHash, wrapper, 2000, false)");
    await weighted.methods.setChainlinkConfig(3, VRF_KEYHASH, VRF_WRAPPER, 2000, false).send({ from: deployer });
    console.log("  done!");

    log("WeightedGame.setHouseEdge(ETH, 400)  // 4%");
    await weighted.methods.setHouseEdge(ZERO, 400).send({ from: deployer });
    console.log("  done!");

    log("WeightedGame.setVRFCallbackGasBase(ETH, 294000)");
    await weighted.methods.setVRFCallbackGasBase(ZERO, 294000).send({ from: deployer });
    console.log("  done!");

    log("COMPLETE!");
    console.log("\n=========================================");
    console.log("  ALL " + total + " CONFIG TXS DONE!");
    console.log("=========================================");
    console.log("Next steps:");
    console.log("1. Go to https://vrf.chain.link/base");
    console.log("2. Create subscription, fund with ~5 LINK");
    console.log("3. Add BOTH consumers: " + COINTOSS_ADDR + " and " + WEIGHTED_ADDR);
    console.log("4. Copy subscription ID, paste into script 4");
  } catch (err) {
    console.log("FAILED at step " + step + ":", err.message || err);
  }
})();
