import { createPublicClient, http, decodeEventLog, getAddress } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const VRF = getAddress("0xd5d517abe5cf79b7e95ec98db0f0277788aff634");

// Check keyHash + timing for user's 9 prior flips
const wagerTxs = [
  { tx: "0xef2d471d59d3e2410dec2e8e39f6c0995cee341a21a0e00b4c7df07d55788c6f", label: "most recent prior" },
  // pick a few — actually scan all user wager txs: identify by looking for Requested events from COINTOSS
];

const abi = [{
  type: "event",
  name: "RandomWordsRequested",
  inputs: [
    { name: "keyHash", type: "bytes32", indexed: true },
    { name: "requestId", type: "uint256", indexed: false },
    { name: "preSeed", type: "uint256", indexed: false },
    { name: "subId", type: "uint256", indexed: true },
    { name: "minimumRequestConfirmations", type: "uint16", indexed: false },
    { name: "callbackGasLimit", type: "uint32", indexed: false },
    { name: "numWords", type: "uint32", indexed: false },
    { name: "extraArgs", type: "bytes", indexed: false },
    { name: "sender", type: "address", indexed: true },
  ],
}];

for (const w of wagerTxs) {
  const rcpt = await client.getTransactionReceipt({ hash: w.tx });
  const log = rcpt.logs.find(l => l.address.toLowerCase() === VRF.toLowerCase());
  if (!log) { console.log(`${w.label}: no VRF log`); continue; }
  const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
  console.log(`${w.label}:`);
  console.log(`  keyHash=${ev.args.keyHash}`);
  console.log(`  callbackGasLimit=${ev.args.callbackGasLimit}`);
}

// Now check: for this keyHash, how recent is the last fulfillment chain-wide?
const KEY = "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70";
// Fetch all Requested events with this keyHash in last 2000 blocks and see how many were fulfilled.
// Requested: keyHash indexed -> topic1.
const reqs = await client.getLogs({
  address: VRF,
  topics: ["0xeb0e3652e0f44f417695e6e90f2f42c99b65cd7169074c5a654b16b9748c3a4e", KEY],
  fromBlock: 44714000n,
  toBlock: 44714700n,
});
console.log(`\nRequests with keyHash=${KEY} in recent 700 blocks: ${reqs.length}`);
for (const l of reqs.slice(-10)) {
  console.log(`  blk ${l.blockNumber}  tx ${l.transactionHash}`);
}
