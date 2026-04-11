const fs = require('fs');
const script = fs.readFileSync('./contracts/remix/2_deploy_cointoss.js', 'utf8');
const ref = fs.readFileSync('./contracts/cointoss-bytecode.txt', 'utf8').trim();

const start = script.indexOf('0x60c0');
const end = script.indexOf('"', start);
const embedded = script.substring(start, end);

console.log('Embedded bytecode length:', embedded.length);
console.log('Reference bytecode length:', ref.length);
console.log('Match:', embedded === ref);
console.log('Embedded ends with:', embedded.substring(embedded.length - 20));
console.log('Reference ends with:', ref.substring(ref.length - 20));
