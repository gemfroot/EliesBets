const VRF_COORDINATOR = "0xE40895D055bccd2053dD0638C9695E326152b1A4";
const COINTOSS = "0x423D077cA13b463eb890B7f278F5A20f258B2b50";
const VRF_SUB_ID = "13734403737332387420523709373793486224704624946028388778544069137368659489750";

async function main() {
  try {
    console.log("Checking VRF subscription...");
    console.log("CoinToss:", COINTOSS);
    console.log("Sub ID:", VRF_SUB_ID);

    // Check if CoinToss is a registered consumer
    var data = web3.eth.abi.encodeFunctionCall({
      name: "getSubscription", type: "function",
      inputs: [{ type: "uint256", name: "subId" }]
    }, [VRF_SUB_ID]);

    try {
      var result = await web3.eth.call({ to: VRF_COORDINATOR, data: data });
      var decoded = web3.eth.abi.decodeParameters(
        ["uint96", "uint96", "address", "address[]"],
        result
      );
      console.log("LINK balance:", (parseInt(decoded[0]) / 1e18).toFixed(4), "LINK");
      console.log("Native balance:", (parseInt(decoded[1]) / 1e18).toFixed(4), "AVAX");
      console.log("Owner:", decoded[2]);
      console.log("Consumers:", JSON.stringify(decoded[3]));

      var consumers = decoded[3];
      var found = false;
      for (var i = 0; i < consumers.length; i++) {
        if (consumers[i].toLowerCase() === COINTOSS.toLowerCase()) {
          found = true;
        }
      }
      if (found) {
        console.log("OK: CoinToss IS registered as a consumer");
      } else {
        console.log("PROBLEM: CoinToss is NOT a consumer!");
        console.log("You need to add", COINTOSS, "as a consumer at https://vrf.chain.link/avalanche");
      }
    } catch (e) {
      console.log("Failed to read subscription. It may not exist or the ABI may differ.");
      console.log("Error:", e.message || e);

      // Try alternate ABI (some coordinators return different tuple)
      console.log("\nTrying alternate check - pendingRequestExists...");
      var data2 = web3.eth.abi.encodeFunctionCall({
        name: "pendingRequestExists", type: "function",
        inputs: [{ type: "uint256", name: "subId" }]
      }, [VRF_SUB_ID]);
      try {
        var result2 = await web3.eth.call({ to: VRF_COORDINATOR, data: data2 });
        console.log("Subscription exists! pendingRequestExists:", web3.eth.abi.decodeParameter("bool", result2));
      } catch (e2) {
        console.log("Subscription may not exist:", e2.message || e2);
      }
    }
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
}

main();
