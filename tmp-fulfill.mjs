import { createPublicClient, http, decodeEventLog, getAddress } from "viem";
import { base } from "viem/chains";
import { getBlockNumber } from "viem/actions";

const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
const VRF = getAddress("0xd5d517abe5cf79b7e95ec98db0f0277788aff634");
const REQUEST_ID = 33181086026068839505016756663281212253523816672424963112831476088498575197863n;
const WAGER_BLOCK = 44714454n;

const head = await getBlockNumber(client);
console.log(`Head: ${head}, wager: ${WAGER_BLOCK}, blocks since: ${head - WAGER_BLOCK}`);

const abi = [{
  type: "event", name: "RandomWordsFulfilled",
  inputs: [
    { name: "requestId", type: "uint256", indexed: true },
    { name: "outputSeed", type: "uint256", indexed: false },
    { name: "subId", type: "uint256", indexed: true },
    { name: "payment", type: "uint96", indexed: false },
    { name: "nativePayment", type: "bool", indexed: false },
    { name: "success", type: "bool", indexed: false },
    { name: "onlyPremium", type: "bool", indexed: false },
  ],
}];

// filter by requestId topic (uint256 indexed → 32-byte hex)
const reqIdTopic = "0x" + REQUEST_ID.toString(16).padStart(64, "0");
console.log(`Looking for fulfillment with requestId topic: ${reqIdTopic}`);

const logs = await client.getLogs({
  address: VRF,
  topics: ["0x49580fdfd9497e1ed5c1b1cec0495087ae8e3f1267470ec2fb015db32e3d6aa7", reqIdTopic],
  fromBlock: WAGER_BLOCK,
  toBlock: head,
});
console.log(`Found ${logs.length} fulfillment logs for this requestId`);
for (const l of logs) {
  const ev = decodeEventLog({ abi, data: l.data, topics: l.topics });
  console.log(`  blk ${l.blockNumber} tx ${l.transactionHash}`);
  console.log(`    success=${ev.args.success}  payment=${ev.args.payment}  nativePayment=${ev.args.nativePayment}  onlyPremium=${ev.args.onlyPremium}`);
}
