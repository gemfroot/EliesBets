// BASE — Diagnose: Read state of all contracts

(async () => {
  // ===== PASTE YOUR ADDRESSES HERE =====
  const BANK     = "0x076bcb7fbea47e4f4ea0bcd98b2f83317142ef96";
  const COINTOSS = "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41";
  const WEIGHTED = "0xD84179B7C51bDF6e3fF8A2bE21De6B1514334b23";
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
      console.log("\n--- BANK ---");
      const bal = web3.eth.abi.decodeParameter("uint256", await call(BANK, "getBalance",
        [{ type: "address", name: "token" }], [ZERO]));
      console.log("ETH balance:", web3.utils.fromWei(bal, "ether"), "ETH");

      const req = web3.eth.abi.decodeParameters(["bool","uint256","uint256"], await call(BANK, "getBetRequirements",
        [{ type: "address", name: "token" }, { type: "uint256", name: "multiplier" }], [ZERO, "20000"]));
      console.log("Token allowed:", req[0], "| Max bet:", web3.utils.fromWei(req[1], "ether"), "ETH | Max count:", req[2]);
    }

    const diagnoseGame = async (label, addr) => {
      if (addr.includes("PASTE")) return;
      console.log("\n--- " + label + " ---");

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

    console.log("\n--- DONE ---");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
