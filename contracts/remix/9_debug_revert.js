const COINTOSS = "0x423D077cA13b463eb890B7f278F5A20f258B2b50";
const ZERO = "0x0000000000000000000000000000000000000000";

async function main() {
  try {
    var accounts = await web3.eth.getAccounts();
    var deployer = accounts[0];
    console.log("Deployer:", deployer);

    // Use generous values - 0.03 AVAX bet + 0.01 AVAX VRF buffer
    var betAmount = web3.utils.toWei("0.03", "ether");
    var totalValue = web3.utils.toWei("0.04", "ether");

    var wagerData = web3.eth.abi.encodeFunctionCall({
      name: "wager", type: "function",
      inputs: [
        { type: "bool", name: "face" },
        { type: "address", name: "receiver" },
        { type: "address", name: "affiliate" },
        {
          type: "tuple", name: "betData",
          components: [
            { type: "address", name: "token" },
            { type: "uint256", name: "betAmount" },
            { type: "uint16", name: "betCount" },
            { type: "uint256", name: "stopGain" },
            { type: "uint256", name: "stopLoss" },
            { type: "uint16", name: "maxHouseEdge" }
          ]
        }
      ]
    }, [true, deployer, deployer, [ZERO, betAmount, 1, "0", "0", 3500]]);

    console.log("Simulating wager (eth_call)...");
    try {
      var result = await web3.eth.call({
        from: deployer,
        to: COINTOSS,
        data: wagerData,
        value: totalValue
      });
      console.log("Simulation PASSED! Return:", result);
    } catch (e) {
      var msg = (e.data || e.message || "").toString();
      console.log("Simulation REVERTED:");
      console.log(msg.substring(0, 800));

      // Try to decode common revert selectors
      if (msg.includes("0x8baa579f")) console.log(">>> InvalidConsumer <<<");
      if (msg.includes("0xe0c24282")) console.log(">>> WrongGasValueToCoverVRFFee <<<");
      if (msg.includes("0xf4d678b8")) console.log(">>> InsufficientBalance <<<");
      if (msg.includes("0x1f6a65b6")) console.log(">>> InvalidSubscription <<<");
      if (msg.includes("0x7a47c3a2")) console.log(">>> ForbiddenToken <<<");
      if (msg.includes("InvalidConsumer")) console.log(">>> CoinToss not registered as consumer <<<");
      if (msg.includes("InsufficientBalance")) console.log(">>> VRF sub needs more LINK <<<");
    }

    // Also try sending the actual tx and catch the error
    console.log("\nAttempting real tx with 500k gas...");
    try {
      var receipt = await web3.eth.sendTransaction({
        from: deployer,
        to: COINTOSS,
        data: wagerData,
        value: totalValue,
        gas: 500000
      });
      console.log("TX SUCCEEDED! Hash:", receipt.transactionHash);
    } catch (e) {
      var txMsg = (e.data || e.message || "").toString();
      console.log("TX FAILED:", txMsg.substring(0, 800));
    }
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
}

main();
