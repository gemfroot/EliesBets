# CoinToss Mainnet Deployment Guide — Avalanche C-Chain

Last updated: 2026-04-12

## Completed Deployment (2026-04-11)

| Contract | Address |
|----------|---------|
| **Bank** | `0x08b4E4cea2768aDc91b4c7Ec14150733AEdD3A3B` |
| **CoinToss** | `0x423D077cA13b463eb890B7f278F5A20f258B2b50` |
| VRF Sub ID | `13734403737332387420523709373793486224704624946028388778544069137368659489750` |
| Deployer | `0x34e8a0bA5Ba94e36a4f1a4b6A9722E5a6042f8D1` |

**Status: LIVE AND WORKING (2026-04-11)**

All steps completed:
- [x] VRF subscription ID set on CoinToss
- [x] CoinToss added as VRF consumer
- [x] Frontend updated with addresses
- [x] Test bet placed and resolved successfully (won 0.1146 AVAX, VRF in 7s)
- [x] Bank liquidity increased to 6 AVAX (max bet ~0.06 AVAX)

## Prerequisites

- A deployer wallet with ~2 AVAX for gas + initial liquidity
- ~5 LINK tokens on Avalanche for VRF subscription funding
- Access to Snowtrace (https://snowtrace.io) or a tool like Remix/Foundry/viem scripts
- The bytecodes in `contracts/bank-bytecode.txt` and `contracts/cointoss-bytecode.txt`

## Reference Addresses — Avalanche Mainnet (43114)

| Item | Address |
|------|---------|
| VRF Coordinator | `0xE40895D055bccd2053dD0638C9695E326152b1A4` |
| VRF Wrapper | `0x62Fb87c10A917580cA99AB9a86E213Eb98aa820C` |
| VRF Key Hash (500 gwei) | `0x84213dcadf1f89e4097eb654e3f284d7d5d5bda2bd4748d8b7fada5b3a6eaa0d` |
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` |
| LINK | `0x5947BB275c521040051D82396192181b413227A3` |
| USDC (native, 6 dec) | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| USDt (native, 6 dec) | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` |

## Step 1: Deploy Bank

Constructor parameters:
```
Bank(address owner, address treasury, address wrappedGasToken, uint256 maxCallGas)
```

| Param | Value |
|-------|-------|
| owner | Your deployer address |
| treasury | Your deployer address (or a separate treasury wallet) |
| wrappedGasToken | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` (WAVAX) |
| maxCallGas | `30000` |

ABI-encode these args and append to `bank-bytecode.txt`. Deploy with **6,000,000+ gas**.

**CRITICAL**: After deployment, verify:
1. Transaction status = success
2. `getCode(bankAddress)` returns non-empty bytecode

## Step 2: Deploy CoinToss

Constructor parameters:
```
CoinToss(address bank, address vrfCoordinator, address vrfWrapper, address wrappedGasToken, uint64 refundTime, uint256 maxCallGas)
```

| Param | Value |
|-------|-------|
| bank | Bank address from Step 1 |
| vrfCoordinator | `0xE40895D055bccd2053dD0638C9695E326152b1A4` |
| vrfWrapper | `0x62Fb87c10A917580cA99AB9a86E213Eb98aa820C` |
| wrappedGasToken | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` (WAVAX) |
| refundTime | `86400` (24 hours) |
| maxCallGas | `30000` |

Deploy with **8,000,000 gas** (CoinToss needs ~4.06M, so 8M provides safe margin).

**CRITICAL**: Verify code exists at the deployed address. On Fuji, 4M gas was not enough and the deploy silently failed.

## Step 3: Configure Bank

Run these transactions in order from the owner wallet:

### 3a. Grant GAME_ROLE to CoinToss
```
Bank.grantRole(GAME_ROLE, coinTossAddress)
```
Get `GAME_ROLE` by calling `Bank.GAME_ROLE()` (it's a bytes32 constant).

### 3b. Add AVAX as betting token
For native AVAX, the token address is `0x0000000000000000000000000000000000000000` (zero address).

```
Bank.addToken(0x0000000000000000000000000000000000000000, true)
```
Second param: `true` = **add** the token, `false` = **remove** it. This is NOT an "isStablecoin" flag as it may appear — it controls add/remove.

### 3c. Allow AVAX for betting
```
Bank.setAllowedToken(0x0000000000000000000000000000000000000000, true)
```

### 3d. Set balance risk
```
Bank.setBalanceRisk(0x0000000000000000000000000000000000000000, 200)
```
200 = 2% of liquidity as max single bet. Adjustable later.

### 3e. Set house edge split
All five values must sum to exactly 10000.

```
Bank.setHouseEdgeSplit(
  0x0000000000000000000000000000000000000000,
  2000,  // bank (20%)
  3000,  // dividend (30%)
  3000,  // referral (30%)
  1000,  // treasury (10%)
  1000   // team (10%)
)
```

### 3f. Unpause AVAX
```
Bank.setPausedToken(0x0000000000000000000000000000000000000000, false)
```

### 3g. Deposit AVAX liquidity
```
Bank.deposit{value: AMOUNT}(0x0000000000000000000000000000000000000000, AMOUNT)
```
For native AVAX, send the deposit amount as both the function argument AND `msg.value`.

Example: to deposit 5 AVAX, send `deposit(zeroAddress, 5e18)` with `msg.value = 5e18`.

## Step 4: Configure CoinToss

### 4a. Set Chainlink VRF config
```
CoinToss.setChainlinkConfig(
  3,          // requestConfirmations (use 3 for safety; 0 may work but is risky)
  0x84213dcadf1f89e4097eb654e3f284d7d5d5bda2bd4748d8b7fada5b3a6eaa0d,  // 500 gwei keyHash
  0x62Fb87c10A917580cA99AB9a86E213Eb98aa820C,  // wrapper
  2000,       // callbackGasExtraBet (uint32, NOT uint16 — ABI type matters!)
  false       // nativePayment = false (pay VRF with LINK, cheaper: 50% vs 60% premium)
)

NOTE on ABI types: The function signature is
  setChainlinkConfig(uint16, bytes32, address, uint32, bool)
The 4th param (callbackGasExtraBet) is uint32 in the actual contract.
Using the wrong type changes the function selector and causes a revert.
```

### 4b. Set house edge for AVAX
```
CoinToss.setHouseEdge(0x0000000000000000000000000000000000000000, 400)
```
400 = 4% house edge.

### 4c. Set VRF callback gas base for AVAX
```
CoinToss.setVRFCallbackGasBase(0x0000000000000000000000000000000000000000, 294000)
```

NOTE: The 2nd param is uint32, NOT uint256. Using the wrong type in your ABI will cause a selector mismatch revert.

## Step 5: VRF Subscription

1. Go to https://vrf.chain.link/avalanche
2. Connect your deployer wallet
3. Create a new subscription
4. Fund with ~5 LINK (if `nativePayment = false`) or ~1 AVAX (if `nativePayment = true`)
5. Add your CoinToss address as a consumer
6. Note the subscription ID

### 5a. Set VRF subscription on CoinToss
```
CoinToss.setVRFSubId(0x0000000000000000000000000000000000000000, subscriptionId)
```

## Step 6: Test

Place a minimum bet (e.g., 0.01 AVAX) to verify the full flow:
1. Call `wager(true, yourAddress, yourAddress, {token: zeroAddress, betAmount: 0.01 AVAX, betCount: 1, stopGain: 0, stopLoss: 0, maxHouseEdge: 1000})`
2. Send `msg.value = betAmount + vrfCost` (get vrfCost from `getChainlinkVRFCost`)
3. Wait for Roll event (~5-30 seconds)
4. Verify payout arrived

## Adding More Tokens Later (USDC, USDT)

For each new ERC20 token, repeat these steps:

### On the Bank:
```
Bank.addToken(tokenAddress, true)          // true = stablecoin for USDC/USDT
Bank.setAllowedToken(tokenAddress, true)
Bank.setBalanceRisk(tokenAddress, 200)     // or your preferred %
Bank.setHouseEdgeSplit(tokenAddress, 2000, 3000, 3000, 1000, 1000)
Bank.setPausedToken(tokenAddress, false)
// Approve + deposit:
IERC20(tokenAddress).approve(bankAddress, amount)
Bank.deposit(tokenAddress, amount)
```

### On CoinToss:
```
CoinToss.setHouseEdge(tokenAddress, 400)
CoinToss.setVRFCallbackGasBase(tokenAddress, 294000)
CoinToss.setVRFSubId(tokenAddress, subscriptionId)
```

### For players betting with ERC20:
- Player must `approve(coinTossAddress, betAmount)` before calling `wager`
- `msg.value` = VRF cost only (not betAmount + vrfCost)
- The contract pulls the ERC20 via `transferFrom`

## Cost Estimates

### Deployment (One-Time)

| Item | Actual Gas | Actual Cost (~1.5-2.5 gwei) |
|------|-----------|----------------------------|
| Bank deployment | 3,788,495 | ~0.006-0.010 AVAX |
| CoinToss deployment | 4,059,770 | ~0.006-0.010 AVAX |
| Configuration txs (~12) | ~650,000 total | ~0.001 AVAX |
| VRF subscription funding | — | 5 LINK |
| Initial liquidity deposit | — | Your choice (we used 6 AVAX) |
| **Total setup (gas only)** | — | **~0.02 AVAX + 5 LINK** |

### Per-Bet Operating Costs

| Item | Cost |
|------|------|
| Gas (successful wager tx) | ~0.0005 AVAX (321k gas) |
| Gas (reverted wager tx) | ~0.0001 AVAX (60k gas) |
| Net VRF fee (paid from msg.value) | ~0.001 AVAX |
| VRF callback (charged to LINK subscription) | ~0.002 LINK |
| **Total user-facing cost per bet** | **~0.0015 AVAX** |

### Liquidity Scaling

Max bet = `bankBalance × balanceRisk / 10000 / multiplier`

For CoinToss (2x) at 2% risk:

| Desired max bet | Required liquidity |
|----------------|-------------------|
| 0.06 AVAX | 6 AVAX |
| 0.5 AVAX | 50 AVAX |
| 1 AVAX | 100 AVAX |
| 10 AVAX | 1,000 AVAX |

To increase max bet: deposit more liquidity OR increase `balanceRisk` (e.g., 500 = 5%).

## Updating the Frontend

After deployment, update the frontend in `src/lib/casino/addresses.ts`:
- Set `BANK_BY_CHAIN[avalanche.id]` to the Bank address
- Set `COIN_TOSS_BY_CHAIN[avalanche.id]` to the CoinToss address

Environment variables (in `.env.local` or Vercel):
```
NEXT_PUBLIC_AVAX_BANK_ADDRESS=0x...
NEXT_PUBLIC_AVAX_COINTOSS_ADDRESS=0x...
```

### Frontend VRF Cost Estimation (CRITICAL)

The frontend must estimate VRF cost to include in `msg.value`. This is the single biggest source of bugs we hit. Key file: `src/lib/casino/hooks.ts`.

**Problem**: Avalanche public RPCs ignore the `gasPrice` parameter in `eth_call`, so `getChainlinkVRFCost` always returns 0 in browser calls. If the frontend sends `msg.value = betAmount + 0`, the contract reverts with `WrongGasValueToCoverVRFFee`.

**Solution implemented** (in `fetchVrfCost` and `placeWager`):
1. Use a fixed `gasPrice: 1 gwei` for the estimation `eth_call` — high enough to always exceed `baseFee`
2. Apply 2x buffer on the estimate
3. If estimate is still 0, fall back to a hardcoded `MIN_VRF_BUDGET = 0.01 AVAX`
4. The contract refunds any excess, so overestimating is safe

```typescript
const safeGasPrice = BigInt(1_000_000_000); // 1 gwei
const result = await client.call({ to, data, gasPrice: safeGasPrice, gas: 500_000n });
// ...decode result...
const MIN_VRF_BUDGET = BigInt(10_000_000_000_000_000); // 0.01 AVAX
const vrfWithBuffer = vrf > 0n ? (vrf * 200n) / 100n : MIN_VRF_BUDGET;
const msgValue = betAmount + vrfWithBuffer; // for native token bets
```

**Why 0.01 AVAX fallback is safe**: Actual VRF cost on Avalanche mainnet is ~0.001 AVAX. The 0.01 AVAX is 10x the typical cost. Any excess is refunded by the contract in the same wager transaction.

### Display "Minimum Bet"

The minimum bet amount shown to users should be a nominal value (e.g., 0.001 AVAX), NOT the VRF cost. The VRF cost is a separate fee added on top of the bet. Conflating them confuses users.

## Troubleshooting

### Transaction reverts at ~22k gas
This means the function selector didn't match anything on the contract. Likely causes:
- **Wrong ABI types** (e.g., `uint16` vs `uint32`) — the selector is computed from `name(type1,type2,...)`, so wrong types = wrong selector
- **Calling a function that doesn't exist** on that contract (e.g., you deployed Bank bytecode but think it's CoinToss)

### Deploy uses ~3.79M gas instead of ~4.06M
You likely deployed the Bank bytecode instead of CoinToss. Check the bytecode size marker:
- Bank: `6200484c` → 18,508 bytes
- CoinToss: `62004be8` → 19,432 bytes

### MetaMask doesn't pop up in Remix
Remix likely auto-switched to "JavaScript VM". Go to Deploy & Run tab → Environment → select "Browser Extension - MetaMask". Verify the deployer address shown is your real wallet.

### VRF callback never arrives (bet stuck as pending)
1. Check the CoinToss is added as a VRF consumer on https://vrf.chain.link
2. Check `nativePayment` matches how you funded the subscription (LINK → `false`, native AVAX → `true`)
3. Check the subscription has sufficient balance
4. Check the VRF sub ID is set on the contract for the bet token

### Deploy runs out of gas / reverts with no error
- Bank needs ~3.8M gas, CoinToss needs ~4.06M gas
- Use 6M+ for Bank, 8M+ for CoinToss
- If bytecode was truncated, the deploy will consume all gas and revert — verify bytecode length before deploying

### Frontend shows "Transaction likely to fail"
MetaMask simulates with `gasPrice = 0`, making VRF cost estimation return 0 inside the contract, causing a simulated revert. The real tx will succeed if `msg.value` includes enough VRF budget. Two fixes:
1. Ensure the frontend adds at least 0.01 AVAX VRF budget (see Frontend section above)
2. Users can click "I want to proceed anyway" if the warning still appears

### Wager reverts with `WrongGasValueToCoverVRFFee`
The VRF budget in `msg.value` was too low. The contract calculates VRF cost at `tx.gasprice`, which can be much higher than the gas price at estimation time (EIP-1559 baseFee fluctuation). Increase the VRF buffer multiplier (we use 2x) or the minimum fallback (we use 0.01 AVAX).

### Bet succeeds but user gets refund (less bet amount than expected)
The contract auto-caps bets to `bankBalance × balanceRisk / multiplier`. Check Bank liquidity and `balanceRisk`. No revert — excess is refunded silently as an internal transfer.

### `eth_call` simulation fails with "max fee per gas less than block base fee"
The `gasPrice` passed to `eth_call` is below the current block's `baseFee`. Use a fixed high value (e.g., 1 gwei or 100 gwei) for simulations — it doesn't cost real gas.

## Quick Redeployment Checklist

For future redeployments on any EVM chain:

1. **Prep**: Get creation bytecodes (`bank-bytecode.txt`, `cointoss-bytecode.txt`), Chainlink VRF addresses for target chain, WAVAX/WETH address
2. **Deploy Bank** (6M+ gas) → save address
3. **Deploy CoinToss** (8M+ gas, verify bytecode length = 38866) → save address
4. **Configure Bank**: grantRole, addToken(true), setAllowedToken, setBalanceRisk, setHouseEdgeSplit (must sum to 10000), setPausedToken(false), deposit liquidity
5. **Configure CoinToss**: setChainlinkConfig (watch uint32 types!), setHouseEdge, setVRFCallbackGasBase
6. **VRF Setup**: Create subscription at vrf.chain.link, fund with LINK, add CoinToss as consumer
7. **Set VRF Sub ID**: setVRFSubId on CoinToss for each bet token
8. **Update frontend**: addresses.ts + hooks.ts VRF estimation params
9. **Test**: Place minimum bet, verify Roll event arrives, verify payout

Total time: ~30 minutes if everything goes smoothly. Budget extra for debugging.

## Chain-Specific Notes

### Avalanche C-Chain (43114)
- Gas price: ~0.055 gwei (very low, but EIP-1559 effectiveGasPrice is ~1.5 gwei)
- VRF cost: ~0.001 AVAX per bet
- VRF latency: ~7 seconds (3 confirmations)
- Chainlink VRF: v2.5, subscription method, fund with LINK
- **Watch out**: Public RPC ignores `gasPrice` in `eth_call` — see Frontend section

### Avalanche Fuji (43113)
- Gas price: ~2 wei (absurdly low)
- VRF cost: ~0.016 AVAX (Chainlink charges minimum regardless of gas price)
- Use 25 gwei floor for VRF estimation
- Good for testing, but gas behavior differs significantly from mainnet
