// BASE — Step 5: Deposit ETH liquidity to the Bank

(async () => {
  // ===== PASTE YOUR BANK ADDRESS + AMOUNT =====
  const BANK = "0x076bcb7fbea47e4f4ea0bcd98b2f83317142ef96";
  const DEPOSIT_ETH = "0.04";
  // =============================================

  if (BANK.includes("PASTE")) { console.log("ERROR: paste Bank address first!"); return; }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const depositWei = web3.utils.toWei(DEPOSIT_ETH, "ether");
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);
  console.log("Depositing", DEPOSIT_ETH, "ETH to Bank...");

  try {
    const receipt = await web3.eth.sendTransaction({
      from: deployer, to: BANK, gas: 200000, value: depositWei,
      data: web3.eth.abi.encodeFunctionCall({ name: "deposit", type: "function",
        inputs: [{ type: "address", name: "_token" }, { type: "uint256", name: "_amount" }]
      }, [ZERO, depositWei])
    });
    console.log("Done! Tx:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed);
    console.log("\nMax bet (CoinToss 2x, 2% risk): ~" + (parseFloat(DEPOSIT_ETH) * 0.01).toFixed(6) + " ETH");
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
})();
