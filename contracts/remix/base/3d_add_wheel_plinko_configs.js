// BASE — Step 3d: Add Wheel + Plinko game configurations (owner-only)
// Run AFTER 3_configure_all.js / 4_set_vrf_sub.js / 5_deposit_liquidity.js.
// Hard refresh Remix first (Ctrl+Shift+R). MetaMask must be on Base (8453)
// and connected to the owner of the WeightedGame contract.
//
// Idempotency: addGameConfig appends. Running this twice creates duplicate
// configs at new indices, which breaks the frontend assumption that
// configId 0 = Wheel Normal, 1 = Plinko Safe, 2 = Plinko Hard. Check the
// "Current configsCount" log line — abort if it's not 0.

(async () => {
  // ===== PASTE YOUR WEIGHTED GAME ADDRESS =====
  const WG = "0xD84179B7C51bDF6e3fF8A2bE21De6B1514334b23";
  // =============================================

  const ABI = [
    {
      type: "function",
      name: "addGameConfig",
      stateMutability: "nonpayable",
      inputs: [
        { name: "weights_", type: "uint64[]" },
        { name: "multipliers_", type: "uint64[]" },
        { name: "gameId", type: "uint32" },
      ],
      outputs: [],
    },
    {
      type: "function",
      name: "configsCount",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256" }],
    },
    {
      type: "function",
      name: "owner",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "address" }],
    },
  ];

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  const wg = new web3.eth.Contract(ABI, WG);

  const owner = await wg.methods.owner().call();
  console.log("Deployer:", deployer);
  console.log("WG owner:", owner);
  if (owner.toLowerCase() !== deployer.toLowerCase()) {
    console.log("ERROR: connected wallet is not the WeightedGame owner. Switch accounts and re-run.");
    return;
  }

  const before = Number(await wg.methods.configsCount().call());
  console.log("Current configsCount:", before);
  if (before !== 0) {
    console.log(
      "ABORTING: configs already exist. Running this would append duplicates at indices " +
        before + "-" + (before + 2) + " and shift the frontend's expected configIds. " +
        "If you really want to add more configs, edit this script to skip the ones already present.",
    );
    return;
  }

  // Canonical configs mirrored from @betswirl/sdk-core:
  //   wheelCachedConfigurations / plinkoCachedConfigurations
  // Values are raw uint64 as the contract stores them (multipliers are in
  // 1/10_000 BP, e.g. 14580 → 1.458×).
  const configs = [
    {
      label: "Wheel Normal",
      gameId: 1,
      weights: ["1", "1", "1", "1", "1", "1", "1", "1", "1", "1"],
      multipliers: ["0", "14580", "0", "18760", "0", "20830", "0", "14580", "0", "31250"],
    },
    {
      label: "Plinko Safe",
      gameId: 2,
      weights: ["3", "30", "120", "350", "1055", "2231", "2422", "2231", "1055", "350", "120", "30", "3"],
      multipliers: ["104167", "31250", "16667", "14584", "11459", "10417", "5209", "10417", "11459", "14584", "16667", "31250", "104167"],
    },
    {
      label: "Plinko Hard",
      gameId: 2,
      weights: ["3", "30", "120", "350", "1055", "2231", "2422", "2231", "1055", "350", "120", "30", "3"],
      multipliers: ["1041667", "156250", "52083", "20833", "12500", "5209", "3125", "5209", "12500", "20833", "52083", "156250", "1041667"],
    },
  ];

  for (let i = 0; i < configs.length; i++) {
    const c = configs[i];
    console.log((i + 1) + "/" + configs.length + " " + c.label + " — addGameConfig(weights, multipliers, gameId=" + c.gameId + ")");
    await wg.methods.addGameConfig(c.weights, c.multipliers, c.gameId).send({ from: deployer });
    console.log("  done");
  }

  const after = Number(await wg.methods.configsCount().call());
  console.log("Final configsCount:", after, "(expected " + (before + configs.length) + ")");
  console.log("Frontend mapping: configId 0 = Wheel Normal, 1 = Plinko Safe, 2 = Plinko Hard");
})();
