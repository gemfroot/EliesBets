// ============================================================
// STEP 1: Deploy Bank on Avalanche Mainnet
// Run this in Remix: right-click > Run
// Make sure MetaMask is on Avalanche and Remix uses "Injected Provider"
// ============================================================

(async () => {
  const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  const MAX_CALL_GAS = 30000;

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  // ABI-encode constructor: (address owner, address treasury, address wrappedGasToken, uint256 maxCallGas)
  const constructorArgs = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address', 'uint256'],
    [deployer, deployer, WAVAX, MAX_CALL_GAS]
  ).slice(2); // remove 0x prefix

  // Fetch bytecode from local file — paste the ENTIRE contents of bank-bytecode.txt below
  const bytecode = "";

  console.log("Deploying Bank... confirm in MetaMask (set gas limit to 6000000)");
  const receipt = await web3.eth.sendTransaction({
    from: deployer,
    data: bytecode + constructorArgs,
    gas: 6000000,
  });

  console.log("=== BANK DEPLOYED ===");
  console.log("Address:", receipt.contractAddress);
  console.log("Tx hash:", receipt.transactionHash);
  console.log("Gas used:", receipt.gasUsed);
  console.log("SAVE THIS ADDRESS! You need it for Step 2.");
})();
