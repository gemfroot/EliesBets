const COINTOSS = "0x423D077cA13b463eb890B7f278F5A20f258B2b50";
const ZERO = "0x0000000000000000000000000000000000000000";

async function main() {
  try {
    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    console.log("Deployer:", deployer);

    // Get VRF cost
    const gasPrice = await web3.eth.getGasPrice();
    const vrfData = web3.eth.abi.encodeFunctionCall({
      name: "getChainlinkVRFCost", type: "function",
      inputs: [{ type: "address", name: "token" }, { type: "uint16", name: "betCount" }]
    }, [ZERO, 1]);
    const vrfResult = await web3.eth.call({ to: COINTOSS, data: vrfData, gasPrice: gasPrice });
    const vrfCost = web3.utils.toBN(web3.eth.abi.decodeParameter("uint256", vrfResult));
    console.log("VRF cost:", web3.utils.fromWei(vrfCost, "ether"), "AVAX");

    // Bet 0.03 AVAX on heads (true)
    var betAmount = web3.utils.toWei("0.03", "ether");
    var vrfBuffer = vrfCost.muln(2);
    var totalValue = web3.utils.toBN(betAmount).add(vrfBuffer);
    console.log("Bet amount: 0.03 AVAX");
    console.log("VRF buffer:", web3.utils.fromWei(vrfBuffer, "ether"), "AVAX");
    console.log("Total msg.value:", web3.utils.fromWei(totalValue, "ether"), "AVAX");

    var data = web3.eth.abi.encodeFunctionCall({
      name: "wager",
      type: "function",
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

    console.log("Sending wager tx... confirm in MetaMask");
    var receipt = await web3.eth.sendTransaction({
      from: deployer,
      to: COINTOSS,
      data: data,
      value: totalValue.toString(),
      gas: 500000
    });

    console.log("Bet placed! Tx:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed);
    console.log("Waiting for VRF callback (~5-30s)...");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
}

main();
