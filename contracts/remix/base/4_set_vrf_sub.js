// BASE — Step 4: Set VRF Subscription ID on BOTH games

(async () => {
  const COINTOSS = "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41";
  const WEIGHTED = "0xD84179B7C51bDF6e3fF8A2bE21De6B1514334b23";
  const VRF_SUB_ID = "26918509160529768386482590375648102694682990310968994035890257531953115622201";
  const ZERO = "0x0000000000000000000000000000000000000000";

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  const abi = [
    {"inputs":[{"name":"_token","type":"address"},{"name":"_vrfSubId","type":"uint256"}],"name":"setVRFSubId","outputs":[],"stateMutability":"nonpayable","type":"function"}
  ];

  const coinToss = new web3.eth.Contract(abi, COINTOSS);
  const weighted = new web3.eth.Contract(abi, WEIGHTED);

  try {
    console.log("1/2 Setting VRF sub on CoinToss...");
    await coinToss.methods.setVRFSubId(ZERO, VRF_SUB_ID).send({ from: deployer });
    console.log("  done!");

    console.log("2/2 Setting VRF sub on WeightedGame...");
    await weighted.methods.setVRFSubId(ZERO, VRF_SUB_ID).send({ from: deployer });
    console.log("  done!");

    console.log("\nBoth games configured with VRF subscription!");
    console.log("Next: run script 5 to deposit liquidity.");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
