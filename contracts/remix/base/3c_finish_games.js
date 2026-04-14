// BASE — Finish config: steps 8-14 (Bank done, just game configs left)
// Hard refresh Remix first (Ctrl+Shift+R) to kill old scripts!

(async () => {
  const COINTOSS_ADDR = "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41";
  const WEIGHTED_ADDR = "0xD84179B7C51bDF6e3fF8A2bE21De6B1514334b23";

  const ZERO = "0x0000000000000000000000000000000000000000";
  const VRF_KEYHASH = "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70";
  const VRF_WRAPPER = "0xb0407dbe851f8318bd31404a49e658143c982f23";

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  const gameAbi = [
    {"inputs":[{"name":"_requestConfirmations","type":"uint16"},{"name":"_keyHash","type":"bytes32"},{"name":"_wrapper","type":"address"},{"name":"_callbackGasExtraBet","type":"uint32"},{"name":"_nativePayment","type":"bool"}],"name":"setChainlinkConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_houseEdge","type":"uint16"}],"name":"setHouseEdge","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_callbackGasBase","type":"uint32"}],"name":"setVRFCallbackGasBase","outputs":[],"stateMutability":"nonpayable","type":"function"},
  ];

  const coinToss = new web3.eth.Contract(gameAbi, COINTOSS_ADDR);
  const weighted = new web3.eth.Contract(gameAbi, WEIGHTED_ADDR);

  try {
    console.log("8/14 CoinToss.setChainlinkConfig...");
    await coinToss.methods.setChainlinkConfig(3, VRF_KEYHASH, VRF_WRAPPER, 2000, false).send({ from: deployer });
    console.log("  done!");

    console.log("9/14 CoinToss.setHouseEdge(ETH, 400)");
    await coinToss.methods.setHouseEdge(ZERO, 400).send({ from: deployer });
    console.log("  done!");

    console.log("10/14 CoinToss.setVRFCallbackGasBase(ETH, 294000)");
    await coinToss.methods.setVRFCallbackGasBase(ZERO, 294000).send({ from: deployer });
    console.log("  done!");

    console.log("11/14 WeightedGame.setChainlinkConfig...");
    await weighted.methods.setChainlinkConfig(3, VRF_KEYHASH, VRF_WRAPPER, 2000, false).send({ from: deployer });
    console.log("  done!");

    console.log("12/14 WeightedGame.setHouseEdge(ETH, 400)");
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
    console.log("3. Add BOTH consumers:");
    console.log("   " + COINTOSS_ADDR);
    console.log("   " + WEIGHTED_ADDR);
    console.log("4. Copy subscription ID, paste into script 4");
  } catch (err) {
    console.log("FAILED:", err.message || err);
  }
})();
