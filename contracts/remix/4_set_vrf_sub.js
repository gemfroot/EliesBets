// ============================================================
// STEP 4: Set VRF Subscription ID
// Run AFTER creating your VRF subscription at vrf.chain.link
// ============================================================

(async () => {
  try {
    const COINTOSS = "0x423D077cA13b463eb890B7f278F5A20f258B2b50";
    const VRF_SUB_ID = "13734403737332387420523709373793486224704624946028388778544069137368659489750";
    const ZERO = "0x0000000000000000000000000000000000000000";

    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    console.log("Deployer:", deployer);

    const data = web3.eth.abi.encodeFunctionCall({
      name: "setVRFSubId",
      type: "function",
      inputs: [
        { type: "address", name: "_token" },
        { type: "uint256", name: "_vrfSubId" }
      ]
    }, [ZERO, VRF_SUB_ID]);

    console.log("Encoded data:", data.substring(0, 10), "...");
    console.log("Sending tx to CoinToss... confirm in MetaMask");

    const receipt = await web3.eth.sendTransaction({
      from: deployer,
      to: COINTOSS,
      data: data,
      gas: 100000
    });

    console.log("Done! Tx hash:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed);
    console.log("CoinToss is now fully configured for AVAX bets.");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
