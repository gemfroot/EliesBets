// Quick debug: check Bank admin roles before running configure script
(async () => {
  const BANK = "0x076bcb7fbea47e4f4ea0bcd98b2f83317142ef96";
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Bank:", BANK);

  const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const GAME_ROLE = "0x6a64baf327d646d1bca72653e2a075d15fd6ac6d8cbd7f6ee03fc55875e0fa88";

  const call = async (name, inputs, args) => {
    const data = web3.eth.abi.encodeFunctionCall({ name, type: "function", inputs }, args);
    return web3.eth.call({ to: BANK, data });
  };

  try {
    // Check if deployer has DEFAULT_ADMIN_ROLE
    const hasAdmin = web3.eth.abi.decodeParameter("bool",
      await call("hasRole",
        [{ type: "bytes32", name: "role" }, { type: "address", name: "account" }],
        [DEFAULT_ADMIN, deployer]));
    console.log("Deployer has DEFAULT_ADMIN_ROLE:", hasAdmin);

    // Check if deployer has GAME_ROLE
    const hasGame = web3.eth.abi.decodeParameter("bool",
      await call("hasRole",
        [{ type: "bytes32", name: "role" }, { type: "address", name: "account" }],
        [GAME_ROLE, deployer]));
    console.log("Deployer has GAME_ROLE:", hasGame);

    // Check owner
    try {
      const ownerRaw = await call("owner", []);
      const owner = web3.eth.abi.decodeParameter("address", ownerRaw);
      console.log("Bank owner:", owner);
      console.log("Deployer is owner:", owner.toLowerCase() === deployer.toLowerCase());
    } catch (e) { console.log("owner() not available or reverted"); }

    // Check getRoleAdmin for GAME_ROLE
    const roleAdmin = web3.eth.abi.decodeParameter("bytes32",
      await call("getRoleAdmin",
        [{ type: "bytes32", name: "role" }],
        [GAME_ROLE]));
    console.log("GAME_ROLE admin role:", roleAdmin);

    // Try simulating grantRole
    console.log("\nSimulating grantRole(GAME_ROLE, CoinToss)...");
    const COINTOSS = "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41";
    try {
      await web3.eth.call({
        from: deployer, to: BANK,
        data: web3.eth.abi.encodeFunctionCall({ name: "grantRole", type: "function",
          inputs: [{ type: "bytes32", name: "role" }, { type: "address", name: "account" }]
        }, [GAME_ROLE, COINTOSS])
      });
      console.log("Simulation OK — grantRole should work!");
    } catch (e) {
      console.log("Simulation FAILED:", e.message || e);
    }
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
