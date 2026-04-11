// ============================================================
// STEP 5: Deposit additional AVAX liquidity to the Bank
// ============================================================

const BANK = "0x08b4E4cea2768aDc91b4c7Ec14150733AEdD3A3B";
const ZERO = "0x0000000000000000000000000000000000000000";
const DEPOSIT_AVAX = "5";

async function main() {
  try {
    const depositWei = web3.utils.toWei(DEPOSIT_AVAX, "ether");
    const accounts = await web3.eth.getAccounts();
    const deployer = accounts[0];
    console.log("Deployer:", deployer);
    console.log("Depositing", DEPOSIT_AVAX, "AVAX to Bank...");

    const data = web3.eth.abi.encodeFunctionCall({
      name: "deposit",
      type: "function",
      inputs: [
        { type: "address", name: "_token" },
        { type: "uint256", name: "_amount" }
      ]
    }, [ZERO, depositWei]);

    const receipt = await web3.eth.sendTransaction({
      from: deployer,
      to: BANK,
      data: data,
      value: depositWei,
      gas: 200000
    });

    console.log("Done! Tx hash:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed);
  } catch (e) {
    console.log("ERROR:", e.message || e);
  }
}

main();
