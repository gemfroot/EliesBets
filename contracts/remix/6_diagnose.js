const BANK = "0x08b4E4cea2768aDc91b4c7Ec14150733AEdD3A3B";
const COINTOSS = "0x423D077cA13b463eb890B7f278F5A20f258B2b50";
const ZERO = "0x0000000000000000000000000000000000000000";

async function main() {
  try {
    const accounts = await web3.eth.getAccounts();
    console.log("Caller:", accounts[0]);

    const gasPrice = await web3.eth.getGasPrice();
    console.log("Current gas price:", gasPrice, "wei (" + (parseInt(gasPrice) / 1e9).toFixed(2) + " gwei)");

    // Check Bank balance
    const balData = web3.eth.abi.encodeFunctionCall({
      name: "getBalance", type: "function",
      inputs: [{ type: "address", name: "token" }]
    }, [ZERO]);
    const balResult = await web3.eth.call({ to: BANK, data: balData });
    const balance = web3.eth.abi.decodeParameter("uint256", balResult);
    console.log("Bank AVAX balance:", web3.utils.fromWei(balance, "ether"), "AVAX");

    // Check max bet (multiplier = 20000 for CoinToss 2x)
    const reqData = web3.eth.abi.encodeFunctionCall({
      name: "getBetRequirements", type: "function",
      inputs: [{ type: "address", name: "token" }, { type: "uint256", name: "multiplier" }]
    }, [ZERO, "20000"]);
    const reqResult = await web3.eth.call({ to: BANK, data: reqData });
    const decoded = web3.eth.abi.decodeParameters(["bool", "uint256", "uint256"], reqResult);
    console.log("Token allowed:", decoded[0]);
    console.log("Max bet:", web3.utils.fromWei(decoded[1], "ether"), "AVAX");
    console.log("Max bet count:", decoded[2]);

    // Check CoinToss token config
    const tokData = web3.eth.abi.encodeFunctionCall({
      name: "tokens", type: "function",
      inputs: [{ type: "address", name: "" }]
    }, [ZERO]);
    const tokResult = await web3.eth.call({ to: COINTOSS, data: tokData });
    const tokDecoded = web3.eth.abi.decodeParameters(
      ["uint16", "uint64", "uint256", "uint32", "uint256"], tokResult
    );
    console.log("House edge:", tokDecoded[0], "BP");
    console.log("Pending bets:", tokDecoded[1]);
    console.log("VRF Sub ID:", tokDecoded[2]);
    console.log("VRF Callback Gas Base:", tokDecoded[3]);
    console.log("VRF Fees accrued:", web3.utils.fromWei(tokDecoded[4], "ether"));

    // Check paused
    const pausedData = web3.eth.abi.encodeFunctionCall({
      name: "paused", type: "function", inputs: []
    }, []);
    const pausedResult = await web3.eth.call({ to: COINTOSS, data: pausedData });
    const paused = web3.eth.abi.decodeParameter("bool", pausedResult);
    console.log("CoinToss paused:", paused);

    // Check VRF cost with current gas price
    const vrfData = web3.eth.abi.encodeFunctionCall({
      name: "getChainlinkVRFCost", type: "function",
      inputs: [{ type: "address", name: "token" }, { type: "uint16", name: "betCount" }]
    }, [ZERO, 1]);
    const vrfResult = await web3.eth.call({ to: COINTOSS, data: vrfData, gasPrice: gasPrice });
    const vrfCost = web3.eth.abi.decodeParameter("uint256", vrfResult);
    console.log("VRF cost (at current gas):", web3.utils.fromWei(vrfCost, "ether"), "AVAX");

    const maxBetNum = parseFloat(web3.utils.fromWei(decoded[1], "ether"));
    const vrfCostNum = parseFloat(web3.utils.fromWei(vrfCost, "ether"));
    console.log("\n--- SUMMARY ---");
    console.log("Max bet:", maxBetNum.toFixed(6), "AVAX");
    console.log("VRF cost:", vrfCostNum.toFixed(6), "AVAX");
    if (maxBetNum < vrfCostNum) {
      console.log("WARNING: Max bet < VRF cost! Need more liquidity.");
      console.log("Min liquidity needed: ~" + (vrfCostNum * 100).toFixed(2) + " AVAX");
    } else {
      console.log("OK: Max bet > VRF cost. Bets should work.");
      console.log("Suggested test bet: " + (maxBetNum * 0.5).toFixed(6) + " AVAX");
    }
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
}

main();
