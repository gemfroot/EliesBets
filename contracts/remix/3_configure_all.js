// ============================================================
// STEP 3: Configure Bank + CoinToss on Avalanche Mainnet
// Run this in Remix: right-click > Run
// Each tx pops MetaMask — confirm each one in sequence.
// ============================================================

(async () => {
  const BANK = "0x08b4E4cea2768aDc91b4c7Ec14150733AEdD3A3B";

  // PASTE NEW COINTOSS ADDRESS HERE (from step 2 re-deploy)
  const COINTOSS = "0x423D077cA13b463eb890B7f278F5A20f258B2b50";

  // Old fake CoinToss (was actually Bank bytecode) — revoke its role
  const OLD_FAKE_COINTOSS = "0x43b012A84afd0e4f109aDC70bBC114F54Ebb2b6f";

  const ZERO = "0x0000000000000000000000000000000000000000";
  const VRF_KEYHASH = "0x84213dcadf1f89e4097eb654e3f284d7d5d5bda2bd4748d8b7fada5b3a6eaa0d";
  const VRF_WRAPPER = "0x62Fb87c10A917580cA99AB9a86E213Eb98aa820C";

  const GAME_ROLE = "0x6a64baf327d646d1bca72653e2a075d15fd6ac6d8cbd7f6ee03fc55875e0fa88";

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Bank:", BANK);
  console.log("NEW CoinToss:", COINTOSS);

  const bankAbi = [
    {"inputs":[{"name":"role","type":"bytes32"},{"name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"role","type":"bytes32"},{"name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},
  ];
  const coinTossAbi = [
    {"inputs":[{"name":"_requestConfirmations","type":"uint16"},{"name":"_keyHash","type":"bytes32"},{"name":"_wrapper","type":"address"},{"name":"_callbackGasExtraBet","type":"uint32"},{"name":"_nativePayment","type":"bool"}],"name":"setChainlinkConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_houseEdge","type":"uint16"}],"name":"setHouseEdge","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"_token","type":"address"},{"name":"_callbackGasBase","type":"uint32"}],"name":"setVRFCallbackGasBase","outputs":[],"stateMutability":"nonpayable","type":"function"},
  ];

  const bank = new web3.eth.Contract(bankAbi, BANK);
  const coinToss = new web3.eth.Contract(coinTossAbi, COINTOSS);

  try {
    console.log("\n--- Fixing Bank Roles ---");

    console.log("1/5 Revoking GAME_ROLE from old fake CoinToss...");
    await bank.methods.revokeRole(GAME_ROLE, OLD_FAKE_COINTOSS).send({ from: deployer });
    console.log("  done!");

    console.log("2/5 Granting GAME_ROLE to NEW CoinToss...");
    await bank.methods.grantRole(GAME_ROLE, COINTOSS).send({ from: deployer });
    console.log("  done!");

    console.log("\n--- Configuring CoinToss ---");

    console.log("3/5 Setting Chainlink VRF config...");
    await coinToss.methods.setChainlinkConfig(3, VRF_KEYHASH, VRF_WRAPPER, 2000, false).send({ from: deployer });
    console.log("  done!");

    console.log("4/5 Setting house edge to 400 BP (4%)...");
    await coinToss.methods.setHouseEdge(ZERO, 400).send({ from: deployer });
    console.log("  done!");

    console.log("5/5 Setting VRF callback gas base...");
    await coinToss.methods.setVRFCallbackGasBase(ZERO, 294000).send({ from: deployer });
    console.log("  done!");

    console.log("\n=========================================");
    console.log("  ALL CONFIG DONE!");
    console.log("=========================================");
    console.log("Next: VRF subscription at https://vrf.chain.link/avalanche");
    console.log("Add consumer:", COINTOSS);
    console.log("Then run script 4 with the subscription ID");
  } catch (err) {
    console.log("ERROR:", err.message || err);
  }
})();
