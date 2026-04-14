// BASE — Continue config from step 4 (steps 1-3 already done)
// Reject ALL pending MetaMask transactions first, then run this.

(async () => {
  const BANK_ADDR = "0x076bcb7fbea47e4f4ea0bcd98b2f83317142ef96";
  const COINTOSS_ADDR = "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41";
  const WEIGHTED_ADDR = "0xD84179B7C51bDF6e3fF8A2bE21De6B1514334b23";

  const ZERO = "0x0000000000000000000000000000000000000000";
  const VRF_KEYHASH = "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70";
  const VRF_WRAPPER = "0xb0407dbe851f8318bd31404a49e658143c982f23";

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  const bankAbi = [
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

  console.log("Steps 1-3 already done. Continuing from step 4...\n");

  try {
    console.log("4/14 Bank.setAllowedToken(ETH, true)");
    await bank.methods.setAllowedToken(ZERO, true).send({ from: deployer });
    console.log("  done!");

    console.log("5/14 Bank.setBalanceRisk(ETH, 200)  // 2%");
    await bank.methods.setBalanceRisk(ZERO, 200).send({ from: deployer });
    console.log("  done!");

    console.log("6/14 Bank.setHouseEdgeSplit(ETH, 2000/3000/3000/1000/1000)");
    await bank.methods.setHouseEdgeSplit(ZERO, 2000, 3000, 3000, 1000, 1000).send({ from: deployer });
    console.log("  done!");

    console.log("7/14 Bank.setPausedToken(ETH, false)");
    await bank.methods.setPausedToken(ZERO, false).send({ from: deployer });
    console.log("  done!");

    console.log("8/14 CoinToss.setChainlinkConfig(3, keyHash, wrapper, 2000, false)");
    await coinToss.methods.setChainlinkConfig(3, VRF_KEYHASH, VRF_WRAPPER, 2000, false).send({ from: deployer });
    console.log("  done!");

    console.log("9/14 CoinToss.setHouseEdge(ETH, 400)  // 4%");
    await coinToss.methods.setHouseEdge(ZERO, 400).send({ from: deployer });
    console.log("  done!");

    console.log("10/14 CoinToss.setVRFCallbackGasBase(ETH, 294000)");
    await coinToss.methods.setVRFCallbackGasBase(ZERO, 294000).send({ from: deployer });
    console.log("  done!");

    console.log("11/14 WeightedGame.setChainlinkConfig(3, keyHash, wrapper, 2000, false)");
    await weighted.methods.setChainlinkConfig(3, VRF_KEYHASH, VRF_WRAPPER, 2000, false).send({ from: deployer });
    console.log("  done!");

    console.log("12/14 WeightedGame.setHouseEdge(ETH, 400)  // 4%");
    await weighted.methods.setHouseEdge(ZERO, 400).send({ from: deployer });
    console.log("  done!");

    console.log("13/14 WeightedGame.setVRFCallbackGasBase(ETH, 294000)");
    await weighted.methods.setVRFCallbackGasBase(ZERO, 294000).send({ from: deployer });
    console.log("  done!");

    console.log("\n=========================================");
    console.log("  ALL CONFIG DONE!");
    console.log("=========================================");
    console.log("Next steps:");
    console.log("1. Go to https://vrf.chain.link/base");
    console.log("2. Create subscription, fund with ~5 LINK");
    console.log("3. Add BOTH consumers: " + COINTOSS_ADDR + " and " + WEIGHTED_ADDR);
    console.log("4. Copy subscription ID, paste into script 4");
  } catch (err) {
    console.log("FAILED:", err.message || err);
  }
})();
