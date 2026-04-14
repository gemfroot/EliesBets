# BetSwirl Contract Research

Last updated: 2026-04-12

## Overview

BetSwirl is a decentralized casino protocol on EVM chains. Games use Chainlink VRF for provably fair randomness. All contracts are verified, immutable, and permanently on-chain.

## Contract Architecture

```
Bank (shared)          ← Holds liquidity, manages allowed tokens, bet requirements
  ├── CoinToss         ← Game logic + VRF integration
  ├── Dice
  ├── Roulette
  ├── Keno
  ├── Wheel
  ├── Plinko
  └── Custom Weighted
```

Each game contract:
- Holds its own token config (house edge, VRF subscription, callback gas)
- Calls `BANK.getBetRequirements()` to check token allowance and max bet
- Requests randomness from Chainlink VRF
- Receives callback, resolves bet, pays out via Bank

## Contract Addresses

### Mainnet — All chains share the same Bank address

| Contract | Address |
|----------|---------|
| **Bank** | `0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA` |
| CoinToss (Polygon) | `0xC3Dff2489F8241729B824e23eD01F986fcDf8ec3` |

Deployed on: Polygon (137), Base (8453), Arbitrum (42161), Avalanche (43114)

**Status as of 2026-04-09: ALL mainnet tokens are paused in the Bank across all chains.**

### Testnet — Polygon Amoy (80002)

| Contract | Address |
|----------|---------|
| **Bank** | `0x89D47048152581633579450DC4888C931CD4c28C` |
| CoinToss | `0xC2fc743768A1a842dD2CfA121359b8545B9876cA` |
| Dice | `0xE14E752c6Ef78fB54da5A28ff7C9f808534603e9` |
| Roulette | `0x5F628ccd0D5929B16fF6E239D8BB8C81F1b0feD9` |
| Keno | `0x77A654D0895baF09c42314FBb4b18822Ec3c1DD0` |
| Wheel | `0xd300a3757dDBb3Eafb8fb3e401a5eb60e4a571b1` |
| Plinko | `0xd300a3757dDBb3Eafb8fb3e401a5eb60e4a571b1` |

**Status: Amoy testnet tokens are active (paused: false).**

### Testnet — Base Sepolia (84532)

| Contract | Address |
|----------|---------|
| **Bank** | `0x637D401554875a330264e910A3778DAf549F2021` |

Game addresses available via `@betswirl/sdk-core` → `casinoChainById[84532].contracts.games`.

## CoinToss Contract

### Constructor Arguments (Polygon mainnet)

| Arg | Value |
|-----|-------|
| bankAddress | `0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA` |
| chainlinkCoordinatorAddress | `0xec0Ed46f36576541C75739E915ADbCb3DE24bD77` |
| chainlinkWrapperAddress | `0xc8F13422c49909F4Ec24BF65EDFBEbe410BB9D7c` |
| wrappedGasToken | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` (WMATIC) |
| refundTime_ | 86400 (24 hours) |
| maxCallGas_ | 30000 |

### Key Functions

#### `wager(bool face, address receiver, address affiliate, BetData betData) payable`

Places a coin toss bet.

- `face`: true = heads, false = tails
- `receiver`: address that receives payout (must be non-zero)
- `affiliate`: affiliate address (must be non-zero — use receiver for self-referral)
- `betData`: struct with `{token, betAmount, betCount, stopGain, stopLoss, maxHouseEdge}`

For native token bets: `msg.value = betAmount + vrfCost`

#### `getChainlinkVRFCost(address token, uint16 betCount) view → uint256`

Returns the VRF callback cost.

**CRITICAL**: This function uses `tx.gasprice` internally. When called via `eth_call` (default for view functions), `tx.gasprice` is 0, so it returns 0. You MUST pass `gasPrice` in the call parameters to get the real cost.

```typescript
// WRONG — returns 0
const cost = await publicClient.readContract({ ... functionName: "getChainlinkVRFCost" });

// CORRECT — returns real cost (~0.15 POL at 200 gwei)
const gasPrice = await publicClient.getGasPrice();
const result = await publicClient.call({
  to: contractAddress,
  data: encodeFunctionData({ abi, functionName: "getChainlinkVRFCost", args: [token, 1] }),
  gasPrice,
  account: callerAddress,
  gas: 100_000n,
});
```

#### `tokens(address) view → (uint16 houseEdge, uint64 pendingCount, uint256 vrfSubId, uint32 VRFCallbackGasBase, uint256 VRFFees)`

Returns token configuration. Key fields:
- `houseEdge`: in basis points (e.g., 400 = 4%)
- `VRFCallbackGasBase`: gas units for VRF callback (e.g., 294000)

#### `paused() view → bool`

Whether the game contract itself is paused.

### Events

#### `PlaceBet(uint256 indexed id, address indexed receiver, address indexed token, uint256 betAmount)`

Emitted in the wager transaction when a bet is placed. This is in the WAGER tx receipt.

#### `Roll(uint256 indexed id, address indexed receiver, address indexed token, uint256 totalBetAmount, bool face, bool[] rolled, uint256 payout)`

Emitted when the VRF callback resolves the bet. This is in a SEPARATE transaction (the Chainlink VRF fulfillment), NOT in the wager tx receipt.

- `rolled[0]`: true = heads, false = tails (the actual result)
- `payout`: amount paid to receiver (0 if lost)
- `face`: what the user bet on

## Bank Contract

### Key Functions

#### `getTokens() view → TokenData[]`

Returns all configured tokens. Each token tuple:
```
[decimals, address, name, symbol, allowed, paused, balanceRisk]
```

A token is playable when `allowed == true && paused == false`.

#### `getBalance(address token) view → uint256`

Returns the bank's liquidity for a given token.

#### `getBetRequirements(address token, uint256 multiplier) view → (bool isAllowed, uint256 maxBetAmount, uint256 maxBetCount)`

Called internally by game contracts during wager. Validates the token is allowed and returns max bet limits.

## Important Gotchas

### 1. Affiliate and Receiver Must Be Non-Zero

```solidity
if (affiliate == address(0) || receiver == address(0))
    revert InvalidAddress();
```

When there's no dedicated affiliate, use the player's own address as self-referral.

### 2. Token Paused ≠ Contract Paused

The game contract can be unpaused (`paused() == false`) but the token can still be paused in the Bank (`token.paused == true`). Both must be active for bets to go through. The Bank check triggers `ForbiddenToken()`.

### 3. VRF Cost is Gas-Price-Dependent

As documented above, `getChainlinkVRFCost` returns 0 in a normal eth_call. The real cost at 200 gwei gas price on Amoy is ~0.15 POL. Always add a 20% buffer.

Estimated formula: `vrfCost ≈ (VRFCallbackGasBase + maxCallGas) × gasPrice`

### 4. Two-Transaction Flow

Bet placement is asynchronous:
1. **Wager tx** — player sends bet → emits `PlaceBet` → requests Chainlink VRF
2. **VRF callback tx** — Chainlink fulfills randomness → emits `Roll` → payout happens

The `Roll` event is NOT in the wager tx receipt. You must watch for it separately (polling or websocket).

### 5. Native Token Uses Zero Address

For native POL/ETH bets, use `address(0)` as the token. The contract internally wraps it using the `wrappedGasToken` configured in the constructor.

## SDK Reference

Package: `@betswirl/sdk-core` (v0.1.27+)

Key exports:
- `casinoChainById[chainId]` — chain config with contract addresses
- `coinTossAbi` — full ABI for CoinToss contract
- `MAX_HOUSE_EGDE` — 3500 (35%, note the typo is intentional in the SDK)
- `defaultCasinoGameParams` — `{ betCount: 1, stopGain: 0n, stopLoss: 0n, vrfFees: 0n }`
- `BP_VALUE` — 10000 (basis points denominator)

The SDK's `getChainlinkVrfCost()` internally fetches gas price and passes it to the contract call — this is the correct approach.

## Our Forked Deployment — Avalanche Fuji Testnet

### Deployed Contracts

| Contract | Address |
|----------|---------|
| **Bank** | `0xa630496e3d1ff7353768cc7f94b2881500dd8010` |
| **CoinToss** | `0x06458ff96e9d9ba5a4c9848ff97681f5c8af7382` |

| Setting | Value |
|---------|-------|
| Network | Avalanche Fuji (43113) |
| Deployer | `0x3f815331b78AFE9c50Fb8D41bAE4d6a06fC8575B` |
| Bet token | LINK (`0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846`) |
| Bank liquidity | 10 LINK |
| House edge | 400 BP (4%) |
| Balance risk | 200 BP (2%) |
| VRF Coordinator | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` |
| VRF Wrapper | `0x327B83F409E1D5f13985c6d0584420FA648f1F56` |
| VRF Key Hash | `0xc799bd1e3bd4d1a41cd4968997a4e03dfd2a3c7c04b695881138580163f42887` |
| VRF Sub ID | `25988476537275815663213936742783661524564330835160584691289944134964626098258` |
| WAVAX | `0xd00ae08403B9bbb9124bB305C09058E32C39A48c` |
| Deployed | 2026-04-10 |

**Status: Verified working.** Test bet placed with 0.1 LINK, VRF callback resolved in ~5s, payout of 0.192 LINK received.

### Deployment Scripts

All scripts are in `contracts/`:

| Script | Purpose |
|--------|---------|
| `deploy-fuji.js` | Deploys Bank + CoinToss, configures everything end-to-end |
| `redeploy-cointoss.js` | Re-deploys CoinToss only (keeps existing Bank) |
| `set-vrf-sub.js <subId>` | Sets VRF subscription ID on CoinToss after manual subscription creation |
| `test-bet.js` | Places a 0.1 LINK test bet and waits for VRF callback |
| `deployment-fuji.json` | Stores all deployed addresses and config |
| `.env` | Deployer private key (testnet only) |

## Forking & Deployment Guide

### Strategy: Bytecode Extraction (No Compilation Needed)

Rather than setting up a full Solidity compilation environment, we extract creation bytecodes from existing verified deployments on block explorers:

1. Find BetSwirl's existing deployment on any chain (e.g., Avalanche Fuji via Snowtrace)
2. Go to the contract's creation transaction
3. Copy the `input data` field — this is the full creation bytecode including constructor args
4. Strip the constructor args from the end (they're ABI-encoded, identifiable by padding)
5. Store in `bank-bytecode.txt` / `cointoss-bytecode.txt`
6. Append fresh constructor args when deploying

### Deployment Order

```
1. Deploy Bank(owner, treasury, wrappedGasToken, maxCallGas)
2. Deploy CoinToss(bank, vrfCoordinator, vrfWrapper, wrappedGasToken, refundTime, maxCallGas)
3. Bank: grantRole(GAME_ROLE, coinToss)
4. Bank: addToken(betToken, isStablecoin)
5. Bank: setAllowedToken(betToken, true)
6. Bank: setBalanceRisk(betToken, riskBP)
7. Bank: setHouseEdgeSplit(betToken, bank%, dividend%, referral%, treasury%, team%)
8. Bank: setPausedToken(betToken, false)
9. Bank: approve + deposit liquidity
10. CoinToss: setChainlinkConfig(confirmations, keyHash, wrapper, extraGas, nativePayment)
11. CoinToss: setHouseEdge(betToken, edgeBP)
12. CoinToss: setVRFCallbackGasBase(betToken, gasBase)
--- Manual steps ---
13. Create VRF subscription at https://vrf.chain.link
14. Fund subscription with LINK (or native token if nativePayment=true)
15. Add CoinToss address as consumer on the subscription
16. CoinToss: setVRFSubId(betToken, subscriptionId)
```

### ERC20 Betting (vs Native Token)

When using an ERC20 token (like LINK) instead of native gas token:

- **User must `approve(coinTossAddress, betAmount)` before calling `wager`**
- **`msg.value` = VRF cost only** (not betAmount + vrfCost as with native token)
- The CoinToss contract calls `transferFrom` to pull the ERC20 bet amount
- The native token value sent covers only the Chainlink VRF fee

```
Native token:  msg.value = betAmount + vrfCost
ERC20 token:   approve(coinToss, betAmount) then msg.value = vrfCost only
```

## Deployment Gotchas (Learned the Hard Way)

### 1. CoinToss Deployment Needs >4M Gas

The Bank contract deploys with ~3.8M gas. The CoinToss contract is larger and needs ~4.06M gas. A 4M gas limit will cause a silent out-of-gas revert. **Use at least 6M gas for CoinToss deployments.**

### 2. Always Check `receipt.status` After Deployment

The `contractAddress` field in a transaction receipt is populated even when the deployment reverts (it's the deterministic CREATE address). You MUST check `receipt.status === "success"` and verify `getCode(address).length > 0`. Failing to do this means the script happily proceeds to configure a non-existent contract, and all config transactions silently succeed as no-ops (calls to an EOA just transfer value).

```javascript
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status === "reverted") throw new Error("Deploy reverted");
const code = await publicClient.getCode({ address: receipt.contractAddress });
if (!code || code.length < 10) throw new Error("No code deployed");
```

### 3. `nativePayment` Must Match Subscription Funding

The `setChainlinkConfig` last parameter (`nativePayment`) controls whether the VRF request pays from the subscription's LINK balance or native token balance:

| `nativePayment` | Subscription must have | Use when |
|-----------------|----------------------|----------|
| `false` | LINK balance | Subscription funded with LINK |
| `true` | Native token (AVAX/ETH) balance | Subscription funded with native |

If mismatched, the VRF request goes through but Chainlink never fulfills the callback — the bet hangs forever with no error. This is a silent failure with no revert.

### 4. VRF Consumer Must Be Registered Before Betting

The CoinToss contract must be added as a consumer on the VRF subscription at https://vrf.chain.link before any bets are placed. If not registered, the `wager` call reverts with `InvalidConsumer()` inside the VRF coordinator.

When re-deploying a game contract, you must add the **new** address as a consumer (the old address being registered doesn't help).

### 5. Gas Price Floors for VRF Cost Estimation (Chain-Specific)

`getChainlinkVRFCost` uses `tx.gasprice` internally, so the gas price you pass in `eth_call` directly affects the returned VRF cost. Different chains need different approaches:

- **Avalanche Fuji**: Gas price is ~2 wei (not gwei). VRF cost returns ~0 with real gas price. Use 25 gwei floor.
- **Avalanche Mainnet**: Gas price is ~0.055 gwei (~55M wei). Very low but functional.
- **Polygon**: Gas price is ~30-200 gwei. Works normally.

**CRITICAL**: Some public RPCs (notably Avalanche's `api.avax.network`) **ignore the `gasPrice` parameter in `eth_call`**, always using `gasPrice = 0`. This means `getChainlinkVRFCost` returns 0 regardless of what you pass. This was confirmed to happen in browser environments (viem's `publicClient.call()`), though Remix's MetaMask-proxied calls work correctly.

**Production fix**: Use a fixed high gas price (1 gwei) for the estimation call, plus a hardcoded minimum VRF budget fallback:
```typescript
const safeGasPrice = BigInt(1_000_000_000); // 1 gwei — stable and above any baseFee
const result = await client.call({ to, data, gasPrice: safeGasPrice, gas: 500_000n });
// If result is 0 or call fails, fall back to 0.01 AVAX minimum budget
const MIN_VRF_BUDGET = BigInt(10_000_000_000_000_000); // 0.01 AVAX
const vrfCost = decoded > 0n ? decoded * 2n : MIN_VRF_BUDGET;
```

The contract refunds any excess VRF payment, so overestimating is safe.

### 6. Calls to Addresses Without Code Succeed Silently

If a contract deployment fails but you don't check, subsequent `writeContract` calls to that address succeed with ~22k gas and 0 events. They're treated as simple ETH transfers. This makes debugging extremely confusing — all your config transactions appear to succeed but do nothing.

### 7. House Edge Split Must Sum to 10000

The `setHouseEdgeSplit(token, bank, dividend, referral, treasury, team)` values must sum to exactly 10000 (100%). If not, the transaction reverts with `WrongHouseEdgeSplit`.

Our config: bank 2000 + dividend 3000 + referral 3000 + treasury 1000 + team 1000 = 10000.

### 8. Payout Math

For CoinToss (2x multiplier, 4% house edge):
- Bet 0.1 on HEADS
- Win: payout = 0.1 × 2 × (1 - 0.04) = 0.192 (1.92x return)
- Lose: payout = 0

Real example (Avalanche mainnet, 2026-04-11):
- Bet: 0.0597 AVAX (auto-capped from 0.1)
- Result: Won (heads)
- Payout: 0.1146 AVAX (1.92x)
- House edge to Bank: 0.00239 AVAX
- Net profit: ~0.0549 AVAX

## Our Deployment — Avalanche Mainnet (43114)

### Deployed Contracts

| Contract | Address |
|----------|---------|
| **Bank** | `0x08b4E4cea2768aDc91b4c7Ec14150733AEdD3A3B` |
| **CoinToss** | `0x423D077cA13b463eb890B7f278F5A20f258B2b50` |

| Setting | Value |
|---------|-------|
| Network | Avalanche C-Chain (43114) |
| Deployer / Owner | `0x34e8a0bA5Ba94e36a4f1a4b6A9722E5a6042f8D1` |
| Bet token | Native AVAX (`address(0)`) |
| Bank liquidity | 6 AVAX (1 initial + 5 added) |
| House edge | 400 BP (4%) |
| Balance risk | 200 BP (2%) |
| House edge split | bank 2000 / dividend 3000 / referral 3000 / treasury 1000 / team 1000 |
| VRF Coordinator | `0xE40895D055bccd2053dD0638C9695E326152b1A4` |
| VRF Wrapper | `0x62Fb87c10A917580cA99AB9a86E213Eb98aa820C` |
| VRF Key Hash | `0x84213dcadf1f89e4097eb654e3f284d7d5d5bda2bd4748d8b7fada5b3a6eaa0d` |
| VRF Subscription ID | `13734403737332387420523709373793486224704624946028388778544069137368659489750` |
| VRF nativePayment | `false` (subscription funded with LINK) |
| VRF confirmations | 3 |
| VRF callback gas base | 294,000 |
| VRF callback gas extra/bet | 2,000 |
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` |
| Deployed | 2026-04-11 |

**Status: LIVE AND WORKING.** First real bet placed 2026-04-11, VRF resolved in 7 seconds. Won 0.1146 AVAX on a 0.0597 AVAX bet (auto-capped from 0.1 AVAX).

### Failed / Abandoned Addresses (Do NOT use)

| Address | What went wrong |
|---------|-----------------|
| `0x43b012A84afd0e4f109aDC70bBC114F54Ebb2b6f` | Accidentally deployed Bank bytecode as "CoinToss" — is a Bank contract, not CoinToss. GAME_ROLE revoked. |
| `0x559Fd14E444C9D6A4afDeE8598251fD66b139E5D` | CoinToss deploy with truncated bytecode — ran out of gas, no code deployed |
| `0x754DAd20f076CCE0C451B68660Fb287BAEEEcFbb` | Same — truncated bytecode, out of gas |

### Deployment Method: Remix IDE (Manual)

All mainnet deploys were done manually via Remix IDE with MetaMask, to avoid exposing the deployer private key to scripts. Deployment scripts are in `contracts/remix/`:

| Script | Purpose |
|--------|---------|
| `1_deploy_bank.js` | Deploys Bank via `web3.eth.sendTransaction` with raw bytecode |
| `2_deploy_cointoss.js` | Deploys CoinToss with correct bytecode (reads from inline, generated by `build-deploy-script.js`) |
| `3_configure_all.js` | Configures Bank roles/tokens and CoinToss VRF/edge settings |
| `4_set_vrf_sub.js` | Sets VRF subscription ID after manual Chainlink VRF setup |
| `5_deposit_liquidity.js` | Deposits additional AVAX liquidity to the Bank |
| `6_diagnose.js` | Reads Bank balance, max bet, CoinToss config, paused status, actual VRF cost |
| `7_test_bet.js` | Places a test bet directly on-chain, bypassing the frontend |
| `8_check_vrf.js` | Checks VRF subscription status and consumer registration |
| `9_debug_revert.js` | Simulates `wager` via `eth_call` then attempts real tx — shows exact revert reason |
| `build-deploy-script.js` | Node script that reads `cointoss-bytecode.txt` and generates `2_deploy_cointoss.js` with the full bytecode inline |

### Automated Scripts (for testnet / future use)

| Script | Purpose |
|--------|---------|
| `deploy-mainnet.js` | Automated Bank + CoinToss deploy for Avalanche Mainnet (uses private key from `.env`) |
| `set-vrf-sub-mainnet.js` | Sets VRF sub ID on mainnet CoinToss |
| `test-bet-mainnet.js` | Places a test AVAX bet on mainnet CoinToss |

## Mainnet Deployment Gotchas (Additional Lessons)

### 9. Bank `addToken` Second Parameter is `added`, NOT `isStablecoin`

`Bank.addToken(address token, bool added)` — the `bool` controls whether to **add** (`true`) or **remove** (`false`) the token from the supported set. Passing `false` tries to remove a non-existent token, which reverts.

```
WRONG:  addToken(0x0000...0000, false)  // tries to REMOVE — reverts
RIGHT:  addToken(0x0000...0000, true)   // ADDS the token
```

This was mislabeled in our initial ABI as `_isStablecoin`. The actual on-chain parameter name is `added`.

### 10. ABI Type Mismatches Cause Silent Selector Mismatch

If your ABI has the wrong type for a parameter (e.g., `uint16` instead of `uint32`), the **function selector changes** because it's computed from `functionName(type1,type2,...)`. The contract receives a call to a non-existent selector and reverts immediately (~22k gas).

Specific mismatches we hit:
- `setChainlinkConfig` 4th param: ABI had `uint16`, actual is **`uint32`** (VRFCallbackGasExtraBet)
- `setVRFCallbackGasBase` 2nd param: ABI had `uint256`, actual is **`uint32`** (callbackGasBase)

**Always verify ABI types against the Solidity source**, not just parameter names.

### 11. CoinToss Uses Chainlink v2 Ownership, Not OpenZeppelin AccessControl

The CoinToss contract (inheriting from `Game.sol`) uses Chainlink's `ConfirmedOwner` pattern, NOT OpenZeppelin's `AccessControl`. The `onlyOwner` modifier checks:

```solidity
require(msg.sender == owner());  // owner() returns the deployer (set in constructor)
```

This is different from the Bank contract which uses `AccessControl` with `DEFAULT_ADMIN_ROLE`. Both the Bank and CoinToss end up owned by the deployer, but through different mechanisms.

### 12. Remix IDE Silently Switches Environment on Refresh

When you refresh the Remix browser tab, the "Deploy & Run" environment resets from "Browser Extension - MetaMask" to "JavaScript VM". All transactions then run on Remix's local fake blockchain, not the real network. The deployer address changes (e.g., to `0x5B38Da6a...`) but this is easy to miss.

**Always verify** the deployer address in the console output matches your MetaMask wallet before running scripts. If it shows a different address, go to Deploy & Run tab and re-select "Browser Extension - MetaMask".

### 13. Large Bytecode Strings Can Be Truncated by Editors/Tools

The CoinToss creation bytecode is ~38,866 hex characters (19,432 bytes). When embedding this in a JavaScript file, some tools may silently truncate the string. A truncated bytecode deploys but immediately runs out of gas (uses ALL gas and reverts).

**Solution**: Generate the deploy script programmatically:
```javascript
// build-deploy-script.js
const bytecode = fs.readFileSync('./contracts/cointoss-bytecode.txt', 'utf8').trim();
const script = `... const bytecode = "${bytecode}"; ...`;
fs.writeFileSync('./contracts/remix/2_deploy_cointoss.js', script);
```

Then **verify** the embedded length matches:
```javascript
console.log("Bytecode length:", bytecode.length, "(should be 38866)");
```

### 14. CoinToss Deployment Needs ~4.06M Gas (More Than Bank)

Updated from gotcha #1:
- Bank deployment: ~3.79M gas
- CoinToss deployment: ~4.06M gas

The CoinToss bytecode is 19,432 bytes vs Bank's 18,508 bytes, and the CoinToss constructor does more initialization (VRF setup, ownership transfer, refund time validation).

### 15. Double-Check Which Bytecode File You're Using

We accidentally deployed the Bank bytecode as "CoinToss" because the wrong file was pasted. The creation bytecodes look very similar at a glance (both start with `0x60c060405234...`).

**Quick verification**: Check the size marker early in the bytecode:
- Bank: `...6200484c...` → 0x484C = 18,508 bytes
- CoinToss: `...62004be8...` → 0x4BE8 = 19,432 bytes

If the deploy gas is suspiciously close to the Bank's (~3.79M), you probably deployed the wrong bytecode.

### 16. Contract Auto-Caps Bets to Max Allowed

If a player bets more than the max allowed by the Bank, the contract does NOT revert. It silently reduces the bet to the max and **refunds the excess** as an internal transfer during the wager tx.

Max bet formula: `maxBet = bankBalance × balanceRisk / 10000 / multiplier`

For CoinToss (2x multiplier) with 6 AVAX liquidity at 2% risk:
```
maxBet = 6 × 200 / 10000 / 2 = 0.06 AVAX
```

If a player sends 0.1 AVAX betAmount, the contract bets 0.06 and refunds 0.04.

**Scaling reference:**
| Desired max bet | Liquidity needed (at 2% risk, 2x game) |
|----------------|----------------------------------------|
| 0.1 AVAX | 10 AVAX |
| 1 AVAX | 100 AVAX |
| 10 AVAX | 1,000 AVAX |

Alternatively, increase `balanceRisk` (e.g., 500 = 5%) to allow larger bets with less liquidity, at higher variance risk.

### 17. MetaMask "Transaction Likely to Fail" on Avalanche

MetaMask's pre-flight gas estimation often fails on Avalanche mainnet CoinToss wagers, showing "This transaction is likely to fail." This is a **false positive** caused by:

1. MetaMask simulates with `gasPrice = 0`, making `getChainlinkVRFCost` return 0 inside the simulation
2. The simulated `chargedVRFCost` then fails the `>= chainlinkVRFCost` check
3. MetaMask sees a revert in simulation and warns the user

The transaction will succeed on-chain as long as `msg.value` includes sufficient VRF budget. Users can safely click "I want to proceed anyway." However, this is a bad UX — the frontend fix (gotcha #5) mitigates this by ensuring adequate VRF budget is always included.

### 18. EIP-1559 Gas Price vs VRF Cost Mismatch

On Avalanche mainnet, the `effectiveGasPrice` in a mined transaction can be significantly higher than `getGasPrice()` at the time of estimation, because EIP-1559 adjusts the baseFee per block. The VRF cost estimation uses the gas price at call time, but the contract charges based on `tx.gasprice` at execution time.

Example from our first bet:
- Estimated gas price (via `getGasPrice`): ~0.055 gwei
- Actual `effectiveGasPrice` in mined tx: ~1.55 gwei (28x higher)
- VRF cost at 0.055 gwei: ~0.000036 AVAX
- VRF cost at 1.55 gwei: ~0.001 AVAX

**Always use at least 2x buffer on VRF cost estimates.** The contract refunds excess.

### 19. Actual Mainnet Costs (Measured 2026-04-11)

| Item | Cost |
|------|------|
| Gas per successful bet | ~0.0005 AVAX (~321k gas × 1.55 gwei) |
| Gas per failed/reverted bet | ~0.0001 AVAX (~60k gas × 1.55 gwei) |
| Net VRF fee per bet | ~0.001 AVAX |
| **Total overhead per bet** | **~0.0015 AVAX** |
| VRF callback latency | ~7 seconds |
| Bank deployment gas | 3,788,495 |
| CoinToss deployment gas | 4,059,770 |
| Configuration txs (~12 total) | ~650k gas total |

### 20. The `msg.value` Composition for Native Token Bets

```
msg.value = betAmount + vrfBudget
```

Where `vrfBudget` should be: `max(estimatedVrfCost × 2, 0.01 AVAX)`

The contract internally calculates:
```
chargedVRFCost = msg.value - betAmount
chainlinkVRFCost = getChainlinkVRFCost(token, betCount)  // uses tx.gasprice
require(chargedVRFCost >= chainlinkVRFCost)  // else reverts WrongGasValueToCoverVRFFee
// Excess (chargedVRFCost - chainlinkVRFCost) is refunded to player as internal transfer
```

If `chargedVRFCost < chainlinkVRFCost`, the tx reverts with `WrongGasValueToCoverVRFFee()`. Since `tx.gasprice` can be higher than your estimate (EIP-1559), always over-budget.

### 21. Remix `web3.eth.sendTransaction` is More Reliable Than ABI Methods

When running scripts in Remix IDE, using `contract.methods.foo().send()` can hang on gas estimation, especially for complex transactions. Using raw `web3.eth.sendTransaction` with manually encoded calldata and explicit `gas` is more reliable:

```javascript
const data = web3.eth.abi.encodeFunctionCall({
  name: "functionName",
  type: "function",
  inputs: [{ type: "address", name: "_token" }, { type: "uint256", name: "_value" }]
}, [tokenAddr, value]);

await web3.eth.sendTransaction({
  from: deployer, to: contractAddr, data: data, gas: 100000
});
```

Always set explicit `gas` to avoid MetaMask popup issues from gas estimation failures.

## Forkability

All contracts are:
- **Verified** on block explorers (Polygonscan, Basescan, etc.)
- **Immutable** — permanently on-chain, cannot be deleted
- **Source available** — Solidity source readable on any block explorer
- **Constructor args visible** — deployment parameters are public
- **Bytecodes extractable** — creation bytecodes can be taken from any existing deployment's creation tx

To fork:
1. Extract creation bytecodes from a block explorer (no Solidity compilation needed)
2. Deploy your own Bank contract and fund it with liquidity
3. Deploy game contracts pointing to your Bank (use >6M gas for games)
4. Configure Bank: add token, set allowed, set balance risk, set house edge split, unpause, deposit liquidity
5. Configure games: set Chainlink config, house edge, VRF callback gas base
6. Set up a Chainlink VRF v2.5 subscription, fund with LINK, add game contracts as consumers
7. Set VRF subscription ID on each game contract
8. **Test with a small bet before going live**

## External Resources

- Docs: https://docs.betswirl.com
- SDK: https://www.npmjs.com/package/@betswirl/sdk-core
- GitHub: https://github.com/BetSwirl
- Token check guide: https://docs.betswirl.com/developer-hub/demos/ui-react/checking-available-tokens
- Chainlink VRF: https://vrf.chain.link
- Fuji Faucet: https://core.app/tools/testnet-faucet
- Fuji LINK Faucet: https://faucets.chain.link/fuji
