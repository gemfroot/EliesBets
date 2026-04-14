// BASE — Test bet on CoinToss (ETH, heads)
// Minimum bet to verify full VRF flow works.

(async () => {
  // ===== PASTE YOUR COINTOSS ADDRESS HERE =====
  const COINTOSS = "0x508d1fCaA41e65E65a2a3978599B48Dfa79cbB41";
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

    console.log("\nBet placed! Tx:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed);
    console.log("Now wait ~5-30s for VRF callback.");
    console.log("Check basescan.org for Roll event on your address.");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
