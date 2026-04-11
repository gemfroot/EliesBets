const fs = require('fs');
const bytecode = fs.readFileSync('./contracts/cointoss-bytecode.txt', 'utf8').trim();

const script = `// ============================================================
// STEP 2: Deploy CoinToss on Avalanche Mainnet
// Run this in Remix: right-click > Run
// ============================================================

(async () => {
  const BANK_ADDRESS = "0x08b4E4cea2768aDc91b4c7Ec14150733AEdD3A3B";
  const VRF_COORDINATOR = "0xE40895D055bccd2053dD0638C9695E326152b1A4";
  const VRF_WRAPPER = "0x62Fb87c10A917580cA99AB9a86E213Eb98aa820C";
  const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  const REFUND_TIME = 86400;
  const MAX_CALL_GAS = 30000;

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  console.log("Deployer:", deployer);

  const constructorArgs = web3.eth.abi.encodeParameters(
    ['address', 'address', 'address', 'address', 'uint64', 'uint256'],
    [BANK_ADDRESS, VRF_COORDINATOR, VRF_WRAPPER, WAVAX, REFUND_TIME, MAX_CALL_GAS]
  ).slice(2);

  const bytecode = "${bytecode}";

  console.log("Bytecode length:", bytecode.length, "(should be 38866)");
  console.log("Deploying CoinToss... confirm in MetaMask (gas limit 8000000!)");
  const receipt = await web3.eth.sendTransaction({
    from: deployer,
    data: bytecode + constructorArgs,
    gas: 8000000,
  });

  console.log("=== COINTOSS DEPLOYED ===");
  console.log("Address:", receipt.contractAddress);
  console.log("Tx hash:", receipt.transactionHash);
  console.log("Gas used:", receipt.gasUsed);
  console.log("SAVE THIS ADDRESS! You need it for Step 3.");
})();
`;

fs.writeFileSync('./contracts/remix/2_deploy_cointoss.js', script);
console.log('Written! File size:', fs.statSync('./contracts/remix/2_deploy_cointoss.js').size);

// Verify
const written = fs.readFileSync('./contracts/remix/2_deploy_cointoss.js', 'utf8');
const start = written.indexOf('0x60c0');
const end = written.indexOf('"', start);
const embedded = written.substring(start, end);
console.log('Embedded bytecode length:', embedded.length);
console.log('Match:', embedded === bytecode);
