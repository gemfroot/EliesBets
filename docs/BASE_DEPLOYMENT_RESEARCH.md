# Base Deployment Research — All BetSwirl Game Forks

Last updated: 2026-04-08

## Goal

Deploy forked BetSwirl contracts on Base mainnet (chain 8453) — starting simple with **CoinToss + WeightedGame (Wheel/Plinko)** = 3 games from 2 game contracts + 1 Bank. Same manual Remix IDE strategy as Avalanche. Dice, Roulette, Keno can be added later to the same Bank without redeploying anything.

Azuro also supports Base (`BaseWETH` environment), so both sports betting and casino can run on the same chain.

---

## Base Chain Reference

| Item | Mainnet | Sepolia Testnet |
|------|---------|-----------------|
| Chain ID | **8453** | 84532 |
| Native gas token | **ETH** | ETH |
| Block explorer | basescan.org | sepolia.basescan.org |
| Public RPC (rate-limited) | `https://mainnet.base.org` | `https://sepolia.base.org` |
| Gas model | EIP-1559 (L2 execution + L1 data cost) | Same |

Base is an OP Stack L2. Every transaction has two cost components:
1. **L2 execution fee** — very cheap (~0.005 gwei minimum base fee)
2. **L1 data fee** — cost to post tx data to Ethereum L1 (often larger than L2 execution)

---

## Chainlink VRF v2.5 on Base

| Item | Address |
|------|---------|
| **VRF Coordinator** | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` |
| **VRF Wrapper (OP Stack)** | `0xb0407dbe851f8318bd31404a49e658143c982f23` |
| **LINK token** | `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196` |
| **Key hash (30 gwei lane)** | `0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70` |
| **Key hash (2 gwei lane)** | `0x00b81b5a830cb0a4009fbd8904de511e28631e62ce5ad231373d3cdad373ccab` |
| VRF premium (native) | 60% |
| VRF premium (LINK) | 50% |
| Max callback gas | 2,500,000 |
| Min confirmations | 0 |

**Use the 30 gwei key hash for production.** The 2 gwei lane is cheaper but slower.

The VRF Wrapper on Base is `VRFV2PlusWrapper_Optimism` — it accounts for L1 data cost in its fee calculations, unlike the Avalanche wrapper. This means VRF costs on Base include the L1 posting overhead automatically.

### Base Sepolia (for testing)

| Item | Address |
|------|---------|
| VRF Coordinator | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` |
| LINK | `0xE4aB69C077896252FAFBD49EFD26B5D171A32410` |
| Key hash (30 gwei) | `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71` |

---

## Token Addresses on Base Mainnet

| Token | Address | Decimals |
|-------|---------|----------|
| ETH (native) | `0x0000000000000000000000000000000000000000` | 18 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| USDbC (bridged) | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6B1` | 6 |

Start with ETH native. Add USDC later (same process as adding USDC/USDt on Avalanche).

---

## Contracts to Deploy (Phase 1: 3 games)

| Contract | Constructor | Bytecode status |
|----------|------------|-----------------|
| **Bank** | `(owner, treasury, wrappedGasToken, maxCallGas)` | Have `bank-bytecode.txt` |
| **CoinToss** | `(bank, vrfCoordinator, vrfWrapper, wrappedGasToken, refundTime, maxCallGas)` | Have `cointoss-bytecode.txt` |
| **WeightedGame** | Same 6 params + `uint8 numRandomWords` (7 total) | Have `weighted-bytecode.txt` |

Wheel and Plinko are the SAME contract (WeightedGame) deployed once. Different game configs are loaded after deployment. One deploy = two games.

### Phase 2 (later, same Bank)

| Contract | Status |
|----------|--------|
| Dice | Extract bytecode, deploy, `grantRole`, configure |
| Roulette | Same |
| Keno | Same |

Adding games later is just: deploy contract → Bank.grantRole → configure VRF/edge → add as VRF consumer. No redeployment of anything existing.

### Constructor Args (Base-specific)

| Param | Value |
|-------|-------|
| bank | Deployed Bank address |
| vrfCoordinator | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` |
| vrfWrapper | `0xb0407dbe851f8318bd31404a49e658143c982f23` |
| wrappedGasToken | `0x4200000000000000000000000000000000000006` (WETH) |
| refundTime | `86400` (24 hours) |
| maxCallGas | `30000` |

---

## Bytecodes — ALL EXTRACTED

| Contract | File | Size | Status |
|----------|------|------|--------|
| Bank | `contracts/bank-bytecode.txt` | 37,018 hex chars | Ready |
| CoinToss | `contracts/cointoss-bytecode.txt` | 38,866 hex chars | Ready |
| WeightedGame | `contracts/weighted-bytecode.txt` | 48,145 hex chars | Ready |

WeightedGame extracted from Polygon creation tx `0x30cdb647...` (7 constructor params stripped: 448 hex chars).

---

## Deployment Steps — SCRIPTED (Remix IDE)

All scripts are pre-built in `contracts/remix/base/`. Run them in order in Remix IDE.
MetaMask must be on **Base mainnet (8453)**. Each script auto-encodes constructor args and calldata.

### YOUR STEPS (just run scripts and paste addresses):

| Step | Script | What it does | You do |
|------|--------|-------------|--------|
| 1 | `1_deploy_bank.js` | Deploys Bank (6M gas) | Confirm in MetaMask, **save address** |
| 2a | `2a_deploy_cointoss.js` | Deploys CoinToss (8M gas) | Paste Bank addr, confirm, **save address** |
| 2b | `2b_deploy_weighted.js` | Deploys WeightedGame (10M gas) | Paste Bank addr, confirm, **save address** |
| 3 | `3_configure_all.js` | 14 config txs (roles, tokens, VRF, edge) | Paste all 3 addrs, confirm 14 MetaMask popups |
| — | vrf.chain.link/base | Create VRF sub, fund 5 LINK, add 2 consumers | Manual in browser |
| 4 | `4_set_vrf_sub.js` | Sets VRF sub ID on both games | Paste addrs + sub ID, confirm 2 popups |
| 5 | `5_deposit_liquidity.js` | Deposits ETH to Bank | Paste Bank addr, set amount, confirm |
| 6 | `6_diagnose.js` | Reads all contract state | Paste addrs, verify everything looks right |
| 7 | `7_test_bet.js` | Places 0.001 ETH test bet on CoinToss | Paste CoinToss addr, confirm, wait for VRF |

**Total: ~20 MetaMask confirmations. No manual ABI encoding. No private key exposure.**

### Gotchas from Avalanche (already handled in scripts):

- `addToken` 2nd param is `added` (true), NOT `isStablecoin` — script uses `true`
- `setChainlinkConfig` 4th param is `uint32` (NOT `uint16`) — script uses correct ABI
- `setVRFCallbackGasBase` 2nd param is `uint32` (NOT `uint256`) — script uses correct ABI
- House edge split must sum to 10000 — script uses 2000+3000+3000+1000+1000
- Bytecodes are validated for length before deploying
- VRF cost estimation uses 1 gwei safe floor + 3x buffer
- Test bet includes 0.0005 ETH minimum VRF budget fallback

### If Remix silently switches to JavaScript VM:
Go to Deploy & Run tab → re-select "Injected Provider - MetaMask". Verify deployer address in console.

---

## Frontend Changes (Claude Code Tasks)

### Task 1: Add Base chain support

**Files**: `src/wagmi.ts`, `src/lib/casino/addresses.ts`

- Add `base` import from `viem/chains`
- Add Base transport in wagmi config: `[base.id]: http("https://mainnet.base.org")`
- Add `base.id` to `CASINO_CHAIN_IDS`
- Add Base bet tokens:
  ```typescript
  [base.id]: [
    { address: zeroAddress, symbol: "ETH", decimals: 18, isNative: true },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, isNative: false },
  ]
  ```
- Add empty address slots for all games on Base (to be filled after deployment):
  ```typescript
  [base.id]: addressFromEnv(process.env.NEXT_PUBLIC_CASINO_BANK_BASE) ?? undefined,
  ```

### Task 2: Fix game hooks (VRF pattern)

**File**: `src/lib/casino/hooks.ts`

Currently only `useCoinToss` has the correct VRF pattern. The other hooks need the same fixes:

1. **`minBetAmount = BigInt(1)`** instead of `vrfCost + BigInt(1)`
2. **200% VRF buffer** instead of 150%
3. **Chain-aware `MIN_VRF_BUDGET` fallback** when VRF returns 0:
   ```typescript
   const MIN_VRF_BUDGET: Record<number, bigint> = {
     43114: BigInt(10_000_000_000_000_000),   // 0.01 AVAX
     8453:  BigInt(500_000_000_000_000),       // 0.0005 ETH
     137:   BigInt(100_000_000_000_000_000),   // 0.1 POL
   };
   const DEFAULT_VRF_BUDGET = BigInt(10_000_000_000_000_000);
   ```
4. **ERC20 approve flow** for non-native tokens (copy from `useCoinToss`)

Priority hooks (Phase 1 games): `useWeightedWheelLikeGame` (covers Wheel + Plinko)
Lower priority (Phase 2): `useDice`, `useRoulette`, `useKeno`

### Task 3: Fix game components (multi-token)

**Priority (Phase 1)**: `src/components/WheelGame.tsx`, `PlinkoGame.tsx`
**Later (Phase 2)**: `DiceGame.tsx`, `RouletteGame.tsx`, `KenoGame.tsx`

Each needs:
- Token selector dropdown (copy pattern from `CoinTossGame.tsx`)
- Stake presets that adapt to token decimals (`parseUnits`/`formatUnits`)
- Pass selected `BetToken` to the hook

### Task 4: Azuro on Base (optional)

**File**: `src/lib/constants.ts`, `src/providers.tsx`

Azuro supports `BaseWETH` environment. To switch:
- Change `CHAIN_ID = 8453` in constants.ts
- The SDK handles the rest via `chainsData`

Or keep Azuro on Polygon (137) and only use Base for casino. They're independent.

---

## Differences: Base vs Avalanche (Summary)

| Factor | Avalanche | Base |
|--------|-----------|------|
| Native gas | AVAX | ETH |
| Wrapped gas | WAVAX `0xB31f66...` | WETH `0x420000...0006` |
| VRF Coordinator | `0xE40895...` | `0xd5D517...` |
| VRF Wrapper | Standard | OP Stack variant (L1 cost aware) |
| VRF Key Hash | 500 gwei lane | 30 gwei lane |
| LINK | `0x5947BB...` | `0x88Fb15...` |
| Gas price (L2) | ~0.055 gwei | ~0.005 gwei minimum |
| L1 data cost | None | Yes (OP Stack rollup) |
| MIN_VRF_BUDGET | 0.01 AVAX (~$0.25) | 0.0005 ETH (~$1.20) |
| Public RPC gasPrice issue | Ignores gasPrice in eth_call | TBD — test after deployment |
| Azuro support | No | Yes (`BaseWETH`) |
| BetSwirl existing deploy | Yes (tokens paused) | Yes (tokens paused) |

---

## Cost Estimates

### Deployment (one-time, Phase 1)

| Item | Estimated Cost |
|------|---------------|
| Bank deployment | ~0.002-0.005 ETH |
| 2 game deployments (CoinToss + WeightedGame) | ~0.005-0.01 ETH |
| Configuration txs (~25 total) | ~0.001 ETH |
| VRF subscription | 5 LINK on Base |
| Initial ETH liquidity | Your choice |
| **Total gas** | **~0.01-0.02 ETH** |

### Per-bet operating costs

| Item | Estimated |
|------|-----------|
| L2 gas (wager tx) | ~0.0001-0.0003 ETH |
| L1 data cost | ~0.0001-0.001 ETH (varies with L1 congestion) |
| VRF fee | ~0.0002-0.001 ETH |
| **Total per bet** | **~0.0005-0.002 ETH** |

These will be more precise after the first deployment + test bet.

---

## Step-by-Step Checklist

### Prep (one-time)

- [x] Extract WeightedGame bytecode → `contracts/weighted-bytecode.txt`
- [x] Generate Remix scripts → `contracts/remix/base/` (7 scripts)
- [x] Frontend: Base chain added to wagmi.ts, addresses.ts, hooks.ts (Claude Code, done)
- [ ] Bridge ~0.05 ETH to Base (for gas + initial liquidity)
- [ ] Bridge ~5 LINK to Base (for VRF subscription)

### Deploy (Remix IDE, ~15 minutes)

- [ ] Run `1_deploy_bank.js` → save Bank address
- [ ] Run `2a_deploy_cointoss.js` (paste Bank addr) → save CoinToss address
- [ ] Run `2b_deploy_weighted.js` (paste Bank addr) → save WeightedGame address
- [ ] Run `3_configure_all.js` (paste all 3 addrs) → confirm 14 txs
- [ ] VRF: go to vrf.chain.link/base → create sub → fund 5 LINK → add both game addrs as consumers → copy sub ID
- [ ] Run `4_set_vrf_sub.js` (paste addrs + sub ID) → confirm 2 txs
- [ ] Run `5_deposit_liquidity.js` (paste Bank addr, set amount) → confirm 1 tx
- [ ] Run `6_diagnose.js` → verify all looks good
- [ ] Run `7_test_bet.js` → place test bet, wait for VRF callback

### After Deploy

- [ ] Give Claude Code the 3 deployed addresses → it updates `addresses.ts`
- [ ] Test frontend end-to-end

---

## Open Questions

1. **Public RPC gasPrice behavior on Base**: Does Base's public RPC (`mainnet.base.org`) ignore `gasPrice` in `eth_call` like Avalanche's does? If yes, our `1 gwei` safe gas price fix should still work. Need to test after deployment.

2. **L1 data cost impact on VRF**: The OP Stack VRF wrapper accounts for L1 data cost, which fluctuates with Ethereum L1 gas. This means VRF cost on Base is less predictable than on Avalanche. The 200% buffer + MIN_VRF_BUDGET fallback should cover this, but worth monitoring.

3. **Azuro chain decision**: Keep Azuro on Polygon (more liquidity, more markets) or move to Base (unified chain for everything)? Can decide later — the frontend supports runtime chain switching.
