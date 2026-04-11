# BetSwirl SDK (`@betswirl/sdk-core`) — Full Research

**Version analyzed:** 0.1.27 (published Nov 7, 2025)
**License:** MIT
**npm:** `@betswirl/sdk-core`
**GitHub:** `github.com/betswirl/sdk` (private repo — 404)
**Docs:** https://docs.betswirl.com/developer-hub/sdks/core/getting-started

---

## 1. Can We Access the Full Source Code?

**YES.** The npm package ships source maps (`dist/index.mjs.map`) that contain the complete original TypeScript source of all 76 files via the `sourcesContent` field. The GitHub repo is private, but every line of code is recoverable from the installed package.

### Package Structure

```
@betswirl/sdk-core/
  package.json
  README.md
  dist/
    index.mjs        (210 KB — bundled ESM, single-line, minified vars)
    index.cjs        (CJS equivalent)
    index.d.ts       (1.2 MB — full TypeScript declarations)
    index.d.cts      (CTS equivalent)
    index.mjs.map    (source map with full sourcesContent)
    index.cjs.map
```

### Original Source File Tree (76 files, reconstructed from source map)

```
src/
  constants.ts                              (488 chars)
  abis/v2/casino/
    bank.ts                                 (28,708 chars)
    cointoss.ts                             (24,408 chars)
    dice.ts                                 (24,666 chars)
    game.ts                                 (18,021 chars — shared casinoGameAbi)
    keno.ts                                 (27,530 chars)
    roulette.ts                             (24,515 chars)
    weightedGame.ts                         (27,822 chars)
    freebet.ts                              (11,027 chars)
  abis/v2/leaderboard/
    leaderboard.ts                          (29,445 chars)
  data/
    chains.ts                               (2,818 chars — chain definitions)
    casino.ts                               (21,528 chars — game types, contract addrs, per-chain configs)
    tokens.ts                               (115 chars)
    api/freebet/
      bets.ts                               (3,079 chars)
      campaigns.ts                          (5,811 chars)
      codeCampaigns.ts                      (5,941 chars)
    api/leaderboard/
      leaderboards.ts                       (19,645 chars)
    subgraphs/protocol/
      documents/types.ts                    (357,945 chars — GraphQL codegen)
      documents/fragments/bet.ts            (1,646 chars)
      documents/fragments/token.ts          (746 chars)
      documents/bet.ts                      (1,319 chars)
      documents/bets.ts                     (1,759 chars)
      documents/token.ts                    (780 chars)
      documents/tokens.ts                   (1,228 chars)
      clients/common.ts                     (1,024 chars — Apollo setup)
      clients/bet.ts                        (9,710 chars)
      clients/token.ts                      (4,657 chars)
  entities/casino/
    game.ts                                 (1,793 chars — AbstractCasinoGame)
    cointoss.ts                             (3,937 chars)
    dice.ts                                 (4,001 chars)
    keno.ts                                 (7,509 chars)
    roulette.ts                             (9,264 chars)
    weightedGame.ts                         (8,967 chars)
    plinko.ts                               (3,145 chars — extends WeightedGame)
    wheel.ts                                (213 chars — extends WeightedGame)
  actions/
    common/approve.ts                       (3,190 chars)
    casino/
      game.ts                               (18,727 chars — placeBet, waitRolledBet core)
      cointoss.ts                           (4,077 chars)
      dice.ts                               (3,864 chars)
      keno.ts                               (4,076 chars)
      roulette.ts                           (4,117 chars)
      weightedGame.ts                       (4,777 chars)
      plinko.ts                             (2,041 chars)
      wheel.ts                              (2,021 chars)
    freebet/claim.ts                        (2,065 chars)
    api/freebet/claim.ts                    (1,620 chars)
    api/leaderboard/leaderboards.ts         (1,961 chars)
    leaderboard/leaderboard.ts              (3,240 chars)
  read/
    common/
      gasPrice.ts                           (742 chars)
      chainlinkVrfCost.ts                   (3,004 chars)
      tokenMetadata.ts                      (2,256 chars)
    casino/
      bank.ts                               (5,815 chars)
      game.ts                               (16,683 chars — getCasinoGames, getBetRequirements)
      cointoss.ts                           (898 chars)
      dice.ts                               (856 chars)
      keno.ts                               (3,676 chars)
      roulette.ts                           (900 chars)
      weightedGame.ts                       (10,764 chars)
      plinko.ts                             (1,053 chars)
      wheel.ts                              (1,046 chars)
    leaderboard/leaderboard.ts              (2,215 chars)
  provider/
    client.ts                               (15,775 chars — BetSwirlClient abstract)
    viemClient.ts                           (15,577 chars — ViemBetSwirlClient)
    wallet.ts                               (1,881 chars — BetSwirlWallet abstract)
    viemWallet.ts                           (4,360 chars — ViemBetSwirlWallet)
  errors/
    codes.ts                                (1,582 chars)
    betSwirlError.ts                        (294 chars)
    types.ts                                (1,125 chars)
  utils/
    api.ts                                  (197 chars)
    bet.ts                                  (3,772 chars)
    chains.ts                               (790 chars)
    format.ts                               (4,555 chars)
    index.ts                                (1,568 chars)
    subgraphs.ts                            (197 chars)
    tokens.ts                               (1,117 chars)
    wallet.ts                               (892 chars)
```

---

## 2. Related BetSwirl Packages

| Package | Version | Purpose |
|---|---|---|
| `@betswirl/sdk-core` | 0.1.27 | Core VanillaJS library — ABIs, game logic, contract interaction, subgraph queries |
| `@betswirl/wagmi-provider` | 0.1.27 | Wagmi-compatible wrapper around sdk-core |
| `@betswirl/ui-react` | 0.2.10 | Full React UI components for the casino (recommended for dApps) |

---

## 3. Dependencies

**Runtime:**
- `viem` ^2.38.6 (peer)
- `@apollo/client` >=4.0.1 (peer, for subgraph queries)
- `graphql` ^16.12.0 (peer)
- `abitype` ^1.0.8
- `decimal.js` ^10.5.0 (precise math for multipliers/payouts)
- `graphql-tag` ^2.12.6
- `rxjs` ^7.8.2

---

## 4. Supported Chains (9 total)

### Mainnets (5)

| Chain | ID | Bank | Games | Leaderboard | Freebet | Default Affiliate |
|---|---|---|---|---|---|---|
| Polygon | 137 | `0x8FB311..` | All 7 | `0x0E5C8E..` | `0x7a1EFD..` | `0xfA6950..` |
| BNB Smart Chain | 56 | `0x8FB311..` | All 7 | `0x0E5C8E..` | `0x7a1EFD..` | `0xCD2532..` |
| Base | 8453 | `0x8FB311..` | All 7 | `0x0E5C8E..` | `0x7a1EFD..` | `0xBf1998..` |
| Arbitrum One | 42161 | `0x8FB311..` | All 7 | `0x0E5C8E..` | `0x7a1EFD..` | `0xf14C79..` |
| Avalanche | 43114 | `0x8FB311..` | All 7 | `0x0E5C8E..` | `0x7a1EFD..` | `0x1a7528..` |

### Testnets (4)

| Chain | ID | Bank |
|---|---|---|
| Polygon Amoy | 80002 | `0x89D470..` |
| Base Sepolia | 84532 | `0x637D40..` |
| Arbitrum Sepolia | 421614 | `0x3ca54e..` |
| Avalanche Fuji | 43113 | `0x25bED5..` |

**Key observation:** On all 5 mainnets, Bank/Leaderboard/Freebet share the SAME addresses (deterministic CREATE2 deployment). Each testnet has unique addresses.

### Contract Addresses (Polygon Mainnet — representative)

| Contract | Address |
|---|---|
| Bank | `0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA` |
| Dice | `0xAa4D2931a9fE14c3dec8AC3f12923Cbb535C0e5f` |
| CoinToss | `0xC3Dff2489F8241729B824e23eD01F986fcDf8ec3` |
| Roulette | `0x6678e3B4AB2a8C8Cdd068F132C21293CcBda33cb` |
| Keno | `0xc3428E4FEb5C770Db51DCb9B1C08223B10994a89` |
| Wheel/Plinko/Custom | `0xdec2A4f75c5fAE4a09c83975681CE1Dd1dff764b` |
| Leaderboard | `0x0E5C8EA20a1EB26e5dDE5AFab5279F546dB92a79` |
| Freebet | `0x7a1EFD33f41150E3247F14209b2a733bc6B1cb7a` |

### Contract Addresses (Polygon Amoy Testnet)

| Contract | Address |
|---|---|
| Bank | `0x89D47048152581633579450DC4888C931CD4c28C` |
| Dice | `0xE14E752c6Ef78fB54da5A28ff7C9f808534603e9` |
| CoinToss | `0xC2fc743768A1a842dD2CfA121359b8545B9876cA` |
| Roulette | `0x5F628ccd0D5929B16fF6E239D8BB8C81F1b0feD9` |
| Keno | `0x77A654D0895baF09c42314FBb4b18822Ec3c1DD0` |
| Wheel/Plinko/Custom | `0xd300a3757dDBb3Eafb8fb3e401a5eb60e4a571b1` |
| Leaderboard | `0x143DB52C913143345B6a24D8f22f1a8BEaC19e16` |
| Freebet | `0xfBE92f62bd32B3b6c2335D757049f190752f5292` |

---

## 5. Architecture Overview

### 5.1. SDK Layers

The SDK is organized in 4 layers:

1. **ABIs** (`src/abis/`) — Full Solidity ABIs for all contracts (Bank, CoinToss, Dice, Roulette, Keno, WeightedGame, Freebet, Leaderboard)
2. **Data / Config** (`src/data/`) — Chain configs, contract addresses, subgraph queries (Apollo/GraphQL), REST API calls (freebet, leaderboard)
3. **Entities** (`src/entities/`) — Game math classes (encode/decode inputs, multiplier calculation, win chance computation)
4. **Actions / Read** (`src/actions/`, `src/read/`) — On-chain read operations and write transactions
5. **Provider** (`src/provider/`) — Client/Wallet abstraction for viem integration

### 5.2. Usage Patterns

The SDK supports 4 usage levels (from most to least integrated):

1. **ViemBetSwirlClient** — Full client with all methods (play*, wait*, get*, fetch*)
2. **BetSwirlWallet** — Lower-level wallet for individual function calls
3. **Standalone functions** — e.g. `placeDiceBet(wallet, ...)` without a client
4. **Function data only** — e.g. `getPlaceBetFunctionData(...)` returns `{ to, abi, functionName, args, encodedData }` — no wallet needed, ideal for React frontends

---

## 6. Exported API (203 total exports)

### 6.1. Game Classes

All game classes extend `AbstractCasinoGame<TInput, TEncodedInput, TRolled, TEncodedRolled>`:

| Class | Input Type | Description |
|---|---|---|
| `CoinToss` | `COINTOSS_FACE` (HEADS/TAILS) | 50/50 coin flip |
| `Dice` | `DiceNumber` (1–99) | Roll under target number |
| `Roulette` | `RouletteNumber[]` (0–36) | Select numbers on 37-slot wheel |
| `Keno` | `KenoBall[]` (1–40) | Pick balls, match drawn balls |
| `WeightedGame` | `WeightedGameConfigId` | Weighted random outcome by config |
| `Wheel` | extends `WeightedGame` | Spinning wheel with weighted segments |
| `Plinko` | extends `WeightedGame` | Ball drop with weighted landing slots |

**Common static methods on all games:**
- `encodeInput(input)` — Encode for contract call
- `decodeInput(encoded)` — Decode from contract
- `decodeRolled(encoded)` — Decode the VRF result
- `getWinChancePercent(input)` — Win probability
- `getMultiplier(input)` — Gross multiplier (BP = basis points, 10000 = 1x)
- `getFormattedMultiplier(input)` — Human-readable multiplier
- `isSingleRolledWin(decodedRolled, encodedInput)` — Did this roll win?
- `getChoiceInputs(houseEdge?)` — All possible bet choices with their multipliers

**WeightedGame / Wheel / Plinko extras:**
- `WeightedGame.getUniqueOutputs(config, houseEdge)` — Distinct outcomes with multipliers and colors
- `Plinko.getSortedPlinkoOutputs(config, houseEdge)` — Sorted plinko slot outputs

### 6.2. Client & Wallet Classes

| Class | Description |
|---|---|
| `BetSwirlWallet` (abstract) | Wallet abstraction — readContract, writeContract, watchContractEvent, signTypedData |
| `ViemBetSwirlWallet` | Viem implementation of BetSwirlWallet |
| `BetSwirlClient` (abstract) | Full client — play*, wait*, get*, fetch* for all games |
| `ViemBetSwirlClient` | Viem implementation of BetSwirlClient |

**ViemBetSwirlClient key methods:**
- `playCoinToss(face, betParams, options?, callbacks?)` / `playDice(cap, ...)` / `playRoulette(numbers, ...)` / `playKeno(balls, config, ...)` / `playWheel(configId, ...)` / `playPlinko(configId, ...)`
- `waitCoinToss(placedBet)` / `waitDiceRolledBet(...)` / etc. — Wait for VRF callback
- `getCasinoGames(onlyActive?)` — List all games with paused status
- `getCasinoTokens(onlyActive?)` — List allowed bet tokens
- `getCasinoGameToken(token, game, affiliate)` — Token info including house edge
- `getBetRequirements(token, multiplier, game)` — Max bet amount, max bet count, is allowed
- `getChainlinkVrfCost(game, tokenAddress, betCount, gasPrice?)` — VRF fee in native currency
- `getKenoConfiguration(token)` — Keno gains table
- `getWeighedGameConfiguration(configId)` — Wheel/Plinko config (weights, multipliers)
- `getLeaderboardClaimableAmount(leaderboardId, player)` — Unclaimed rewards
- `claimLeaderboardRewards(leaderboard, receiver)` — Claim
- `signAndClaimFreebetCode(code)` — EIP-712 sign + claim

**Subgraph / API fetch methods (on BetSwirlClient):**
- `fetchBets(filter?, page?, itemsPerPage?, sortBy?)` — Historical bets via subgraph
- `fetchBet(id)` / `fetchBetByHash(txHash)` — Single bet lookup
- `fetchTokens(page?)` / `fetchToken(address)` — Token stats from subgraph
- `fetchFreebets(player, affiliates?, chainIds?)` — Available freebets from API
- `fetchFreebetCampaigns(...)` / `fetchFreebetCodeCampaigns(...)` — Campaign listings
- `fetchLeaderboards(...)` / `fetchAffiliateLeaderboards(...)` — Leaderboard data

### 6.3. Standalone Functions (no client needed)

**Bet placement (wallet required):**
- `placeBet(wallet, betParams, options?, callbacks?)` — Generic bet placement
- `placeCoinTossBet(wallet, face, params, ...)` / `placeDiceBet(...)` / `placeRouletteBet(...)` / `placeKenoBet(...)` / `placeWheelBet(...)` / `placePlinkoBet(...)` / `placeWeightedGameBet(...)`
- Freebet variants: `placeCoinTossFreebet(...)`, etc.

**Function data (NO wallet needed — ideal for frontends):**
- `getPlaceBetFunctionData(gameParams, chainId)` — Returns `{ data: { to, abi, functionName, args }, encodedData, extraData: { getValue(vrfCost) } }`
- `getPlaceFreebetFunctionData(gameParams, chainId)` — Same for freebets
- `getBetRequirementsFunctionData(tokenAddress, multiplier, chainId)`
- `getChainlinkVrfCostFunctionData(game, tokenAddress, betCount, chainId)`
- `getGamePausedFunctionData(game, chainId)`
- `getTokenInfoFunctionData(game, tokenAddress, chainId)`
- `getAffiliateHouseEdgeFunctionData(game, tokenAddress, affiliate, chainId)`
- `getCasinoTokensFunctionData(chainId)`
- `getWeightedGameConfigurationFunctionData(configId, chainId)`
- `getKenoConfigurationFunctionData(tokenAddress, chainId)`
- `getClaimableAmountFunctionData(playerAddress, leaderboardId, chainId)`
- `getClaimRewardsLeaderboardFunctionData(leaderboard, receiver)`
- `getAllowanceFunctionData(tokenAddress, allower, spender)`
- `getApproveFunctionData(tokenAddress, spender, amount)`
- `getTokenDecimalsFunctionData(tokenAddress)` / `getTokenSymbolFunctionData(tokenAddress)`

**Read operations (wallet required):**
- `getCasinoGames(wallet, onlyActive?)` / `getCasinoGamePaused(wallet, game)`
- `getCasinoTokens(wallet, onlyActive?)` / `getCasinoGameToken(wallet, token, game, affiliate)`
- `getBetRequirements(wallet, token, multiplier, game)`
- `getChainlinkVrfCost(wallet, game, tokenAddress, betCount, gasPrice?, gasPriceType?)`
- `getKenoConfiguration(wallet, token)` / `getWeightedGameConfiguration(wallet, configId)`
- `getTokenMetadata(wallet, tokenAddress, chainId)`
- `getGasPrices(wallet, chainId?)` — Returns normal/fast/instant gas prices
- `getLeaderboardClaimableAmount(wallet, leaderboardId, player, chainId)`
- `approve(wallet, tokenAddress, allower, spender, amount, gasPrice?, pollingInterval?, allowanceType?, onApprovePending?)`

**Receipt parsing:**
- `getPlacedBetFromReceipt(wallet, receipt, game, chainId?, usedToken?)`
- `getCoinTossPlacedBetFromReceipt(wallet, receipt)` / `getDicePlacedBetFromReceipt(...)` / etc.

**Roll waiting:**
- `waitRolledBet(wallet, placedBet, options?)` — Generic wait for Roll event
- `waitCoinTossRolledBet(wallet, placedBet, options?)` / `waitDiceRolledBet(...)` / etc.
- Weighted game variants take extra `weightedGameConfig` + `houseEdge` params

**Event data:**
- `getPlaceBetEventData(game, chainId, receiver)` — For watching PlaceBet events
- `getRollEventData(game, chainId, betId)` — For watching Roll events

**Payout math:**
- `getBetSwirlFees(payout, houseEdge)` — Protocol fee from payout
- `getGrossPayout(amount, betCount, grossMultiplier)` — Before fees
- `getNetPayout(amount, betCount, grossMultiplier, houseEdge)` — After fees
- `getNetMultiplier(grossMultiplier, houseEdge)` / `getFormattedNetMultiplier(...)`
- `getPayoutDetails(...)` — All payout fields at once

**Decode helpers:**
- `decodeNormalCasinoInput(encoded, game)` / `decodeNormalCasinoRolled(encoded, game)`
- `decodeWeightedCasinoInput(encoded)` / `decodeWeightedCasinoRolled(encoded, config, houseEdge?)`
- `parseRawBetRequirements(raw, token, multiplier, game, chainId)` / `parseRawCasinoToken(raw, chainId)`
- `parseRawWeightedGameConfiguration(raw, configId, chainId)` / `parseRawKenoConfiguration(raw, token, chainId)`
- `parseRawTokenInfoAndAffiliateHouseEdge(rawTokenInfo, rawAffiliateHouseEdge, casinoToken, game)`

**Formatting:**
- `formatAmount(amount, formatType?)` / `formatRawAmount(rawAmount, decimals?, formatType?)`
- `formatCasinoBet(betFragment, chainId, formatType?)` — Format subgraph bet data
- `formatCasinoRolledBet(placedBet, rollEvent, formatType?)` — Format on-chain result
- `formatToken(tokenFragment, chainId, formatType?)` — Format subgraph token
- `formatTokenUrl(address, chainId)` / `formatAccountUrl(address, chainId)` / `formatTxnUrl(hash, chainId)` — Block explorer URLs
- `formatChainlinkSubscriptionUrl(subscriptionId, chainId)` — VRF subscription page URL
- `formatRawLeaderboard(...)` / `formatRawAffiliateLeaderboard(...)`
- `formatRawFreebetCampaign(...)` / `formatRawFreebetCodeCampaign(...)`

**API helpers:**
- `fetchFreebets(player, affiliates?, chainIds?, withExternal?, testMode?)`
- `fetchFreebetCampaigns(...)` / `fetchFreebetCampaign(id, testMode?)`
- `fetchFreebetCodeCampaigns(...)` / `fetchFreebetCodeCampaign(id, testMode?)`
- `fetchLeaderboards(...)` / `fetchAffiliateLeaderboards(...)` / `fetchLeaderboard(id, player?, testMode?)` / `fetchAffiliateLeaderboard(id, testMode?)`
- `refreshLeaderboardsWithBets(betIds, chainId, betType, testMode?)` — Notify API about new bets
- `claimFreebetCode(signature, typedData, chainId, testMode?)` / `signFreebetCode(wallet, code)` / `getClaimFreebetCodeTypedData(code, userAddress)`
- `claimLeaderboardRewards(wallet, leaderboard, receiver, pollingInterval?, onClaimPending?)`

**Utilities:**
- `getCasinoChainId(wallet, ...overridedChainIds)` — Resolve active chain
- `chainNativeCurrencyToToken(nativeCurrency)` — Convert chain currency to Token type
- `rawTokenToToken(rawToken, chainId)` — Convert raw API token to Token
- `getTransactionReceiptWithRetry(wallet, txHash, retries?)` — Retry receipt fetch
- `initViemBetSwirlClient(publicClient, walletClient?, options?)` — Factory function
- `bigIntFormatter(key, value)` — JSON replacer for BigInt serialization
- `truncate(str, len, separator?)` — Truncate string
- `getBetSwirlBetUrl(betId, game, chainId)` — BetSwirl website bet URL
- `generateRandomHexColor()` — Random color for UI
- `getBetSwirlApiUrl(isTestMode?)` — Returns API base URL

### 6.4. Enums

| Enum | Values |
|---|---|
| `CASINO_GAME_TYPE` | `COINTOSS`, `DICE`, `ROULETTE`, `KENO`, `WHEEL`, `PLINKO`, `CUSTOM_WEIGHTED_GAME` |
| `CASINO_GAME_SUBGRAPH_TYPE` | `CoinToss`, `Dice`, `Roulette`, `Keno`, `Wheel`, `Plinko`, `CUSTOM_WEIGHTED_GAME` |
| `CASINO_GAME_LABEL_TYPE` | `"Coin Toss"`, `"Dice"`, `"Roulette"`, `"Keno"`, `"Wheel"`, `"Plinko"`, `"Custom game"` |
| `COINTOSS_FACE` | `TAILS`, `HEADS` |
| `GAS_PRICE_TYPE` | `NORMAL`, `FAST`, `INSTANT` |
| `ALLOWANCE_TYPE` | `ALWAYS`, `AUTO`, `NONE` |
| `FORMAT_TYPE` | `MINIFY`, `STANDARD`, `PRECISE`, `FULL_PRECISE` |
| `ROULETTE_INPUT_BUNDLE` | `FIRST_ROW`, `SECOND_ROW`, `THIRD_ROW`, `FIRST_HALF`, `SECOND_HALF`, `FIRST_DOZEN`, `SECOND_DOZEN`, `THIRD_DOZEN`, `EVEN`, `ODD`, `RED`, `BLACK` |
| `KENO_INPUT_BUNDLE` | `MAX_FIRST_NUMBERS`, `MAX_LAST_NUMBERS`, `FIRST_AND_LAST` |
| `FREEBET_CAMPAIGN_STATUS` | `PENDING`, `EXPIRED` |
| `LEADERBOARD_STATUS` | `NOT_STARTED`, `PENDING`, `ENDED`, `FINALIZED`, `EXPIRED` |
| `LEADERBOARD_TYPE` | `CASINO`, `SPORTS` |
| `CasinoBetFilterStatus` | `RESOLVED`, `PENDING` |
| `Bet_OrderBy` | ~70 subgraph sort keys |
| `OrderDirection` | `Asc`, `Desc` |

### 6.5. ABIs

| ABI Export | Contract |
|---|---|
| `bankAbi` | Bank contract |
| `coinTossAbi` | CoinToss game |
| `diceAbi` | Dice game |
| `rouletteAbi` | Roulette game |
| `kenoAbi` | Keno game |
| `wheelAbi` | Wheel (WeightedGame) |
| `weightedGameAbi` | Shared WeightedGame base |
| `casinoGameAbi` | Common game interface |
| `freebetAbi` | Freebet contract |
| `leaderboardAbi` | Leaderboard contract |

**Per-game event ABIs:**
- `COINTOSS_ROLL_ABI`, `DICE_ROLL_ABI`, `ROULETTE_ROLL_ABI`, `KENO_ROLL_ABI`, `WEIGHTED_GAME_ROLL_ABI`
- `COINTOSS_PLACE_BET_ABI`, `DICE_PLACE_BET_ABI`, `ROULETTE_PLACE_BET_ABI`, `KENO_PLACE_BET_ABI`, `WEIGHTED_GAME_PLACE_BET_ABI`
- `CASINO_GAME_ROLL_ABI` — Record keyed by `CASINO_GAME_TYPE`
- `CASINO_GAME_PLACE_BET_ABI` — Record keyed by `CASINO_GAME_TYPE`

### 6.6. Key Constants

| Constant | Value |
|---|---|
| `BP_VALUE` | `10000` (basis points denominator — 10000 = 1x multiplier) |
| `MAX_HOUSE_EGDE` | `3500` (35% max house edge) |
| `MAX_SDK_HOUSE_EGDE` | `1000` (10% max SDK-enforced edge) |
| `MIN_SELECTABLE_DICE_NUMBER` | 1 |
| `MAX_SELECTABLE_DICE_NUMBER` | 99 |
| `MIN_SELECTABLE_ROULETTE_NUMBER` | 0 |
| `MAX_SELECTABLE_ROULETTE_NUMBER` | 36 |
| `GAS_TOKEN_ADDRESS` | `0x0000...0000` (native gas token) |
| `BETS_ADDRESS` | BetSwirl BETS token address |
| `DEFAULT_ADMIN_ROLE` | `0x00...00` (32 bytes) |
| `BETSWIRL_BASE_URL` | `https://betswirl.com` |
| `BETSWIRL_API_URL` | `https://api.betswirl.com/api` |
| `BETWIRL_TEST_API_URL` | `https://api-dev.betswirl.com/api` |
| `DEFAULT_PAGE` | `1` |
| `DEFAULT_ITEMS_PER_PAGE` | `25` |

### 6.7. Max Bet Counts Per Game

| Game | Max Bets Per TX |
|---|---|
| CoinToss | 100 |
| Dice | 200 |
| Roulette | 200 |
| Keno | 125 |
| Wheel | 100 |
| Plinko | 100 |

### 6.8. Cached Configurations (Wheel/Plinko)

All chains share the same config structure:

**Wheel:** 1 config per chain
- Config ID 0: "Normal" — 10 weighted segments

**Plinko:** 2 configs per chain
- Config ID 1: "Safe" — 13 weighted slots
- Config ID 2: "Volatile" — 13 weighted slots

---

## 7. Key Types

### `BetSwirlClientOptions`
```typescript
{
  gasPriceType?: GAS_PRICE_TYPE;
  gasPrice?: bigint;
  chainId?: number;
  affiliate?: Hex;
  allowanceType?: ALLOWANCE_TYPE;
  pollingInterval?: number;
  formatType?: FORMAT_TYPE;
  subgraphClient?: SubgraphCasinoClient;
  api?: { testMode?: boolean };
}
```

### `CasinoBetParams` (common to all games)
```typescript
{
  betAmount: bigint;
  betToken: Hex;           // Token address (0x0 for native)
  betCount: number;        // 1–200 depending on game
  receiver: Hex;           // Who receives the payout
  stopGain: bigint;        // Auto-stop on cumulative gain
  stopLoss: bigint;        // Auto-stop on cumulative loss
}
```

### `PlaceBetFunctionData` return
```typescript
{
  data: {
    to: Hex;                // Game contract address
    abi: Abi;               // Game ABI
    functionName: string;   // "wager"
    args: readonly [...];   // Encoded args
  };
  encodedData: Hex;         // ABI-encoded calldata
  extraData: {
    getValue(vrfCost: bigint): bigint;  // Calculates msg.value
  };
}
```

### `CasinoPlacedBet`
```typescript
{
  id: string;
  game: CASINO_GAME_TYPE;
  betAmount: bigint;
  formattedBetAmount: string;
  betCount: number;
  token: Token;
  encodedInput: string;
  receiver: Hex;
  chainId: CasinoChainId;
  placeBetHash: Hex;
  stopGain: bigint;
  stopLoss: bigint;
}
```

### `CasinoRolledBet` (extends CasinoPlacedBet)
```typescript
{
  // ... all CasinoPlacedBet fields ...
  rolled: string[];
  decodedRolled: any[];
  payout: bigint;
  formattedPayout: string;
  payouts: bigint[];
  isWin: boolean;
  rollHash: Hex;
}
```

### `BetRequirements`
```typescript
{
  token: Token;
  multiplier: BP;
  maxBetAmount: bigint;
  maxBetCount: number;
  isAllowed: boolean;
  chainId: CasinoChainId;
}
```

### `CasinoToken`
```typescript
{
  symbol: string;
  address: Hex;
  decimals: number;
  paused: boolean;
  balanceRisk: { current: BP; max: BP };
  balanceRiskPercent: { current: number; max: number };
  bankrollProvider: Hex;
  houseEdgeSplit: HouseEdgeSplit;
  chainId: CasinoChainId;
}
```

---

## 8. Subgraph / GraphQL Integration

The SDK uses Apollo Client to query BetSwirl's The Graph subgraphs for historical data.

**Subgraph endpoints per chain (mainnets use The Graph Gateway):**
- Polygon: `gateway.thegraph.com/api/{key}/deployments/id/QmUa6b7...`
- BNB: `gateway.thegraph.com/api/{key}/deployments/id/Qmd5oqy...`
- Base: `gateway.thegraph.com/api/{key}/deployments/id/QmZuY97...`
- Arbitrum: `gateway.thegraph.com/api/{key}/deployments/id/QmYMwfk...`
- Avalanche: `gateway.thegraph.com/api/{key}/deployments/id/Qmf3Kfd...`
- Testnets: Studio endpoints (free, no API key needed)

**Exported GraphQL documents:**
- `BetFragmentDoc` — Bet data fragment
- `BetDocument` — Single bet query
- `BetsDocument` — Paginated bets query

**Query types:**
- `BetFragment` — Full bet data shape (ID, amounts, game, token, timestamps, payout, roll results, etc.)
- `BetsQueryVariables` — Filter, pagination, sorting
- `CasinoBetFilterStatus` — `RESOLVED` | `PENDING`
- `Bet_OrderBy` — Sort fields

---

## 9. REST API Integration

The SDK also calls BetSwirl's REST API (not subgraph) for:

**API base URLs:**
- Production: `https://api.betswirl.com/api`
- Test: `https://api-dev.betswirl.com/api`

**Freebet endpoints:**
- `fetchFreebets(player, affiliates?, chainIds?)` — Get available freebets for a player
- `fetchFreebetCampaigns(...)` — List freebet campaigns
- `fetchFreebetCodeCampaigns(...)` — List code-redeemable campaigns
- `claimFreebetCode(signature, typedData, chainId)` — Claim via EIP-712 signature

**Leaderboard endpoints:**
- `fetchLeaderboards(...)` — List leaderboards with rankings
- `fetchAffiliateLeaderboards(affiliate, ...)` — Affiliate-specific leaderboards
- `refreshLeaderboardsWithBets(betIds, chainId, betType)` — Notify API of new bets

---

## 10. Error Handling

```typescript
ERROR_CODES = {
  CHAIN: { UNSUPPORTED_CHAIN, UNSUPPORTED_GAME, CHAIN_ID_MISMATCH },
  TRANSACTION: { TOKEN_APPROVAL_ERROR, TOKEN_METADATA_ERROR },
  READ: { CHAINLINK_VRF_COST_ERROR },
  GAME: {
    PLACE_BET_ERROR, PLACE_FREEBET_ERROR, PLACE_BET_EVENT_NOT_FOUND,
    ROLL_EVENT_ERROR, ROLL_EVENT_TIMEOUT,
    GET_PAUSED_ERROR, GET_TOKEN_ERROR, GET_AFFILIATE_HOUSE_EDGE_ERROR,
    GET_KENO_CONFIGURATION_ERROR, GET_WEIGHTED_GAME_CONFIGURATION_ERROR
  },
  BANK: { GET_TOKENS_ERROR, GET_BET_REQUIREMENTS_ERROR },
  SUBGRAPH: { FETCH_BET_ERROR, FETCH_BETS_ERROR, FETCH_TOKENS_ERROR, FETCH_TOKEN_ERROR },
  WALLET: { ACCOUNT_MISSING, GET_TRANSACTION_RECEIPT_ERROR },
  LEADERBOARD: { TOO_MANY_BETS, GET_CLAIMABLE_AMOUNT_ERROR, UNSUPPORTED_CHAIN, NO_CLAIMABLE_AMOUNT }
}
```

Error classes: `BetSwirlError`, `ChainError`, `TransactionError`, `ConfigurationError`, `SubgraphError`

---

## 11. Implications for Our Project

### If we fork contracts:
- The SDK hardcodes contract addresses per chain. We would need to either:
  - **Option A:** Patch the SDK to add our chain/addresses (not recommended — upgrade friction)
  - **Option B:** Use the "function data" pattern — call `getPlaceBetFunctionData(...)` and override the `to` address ourselves
  - **Option C:** Copy the game logic classes (CoinToss, Dice, etc.) and ABI exports into our own code, bypassing the SDK entirely for contract interaction while keeping the math utilities

### If we stay as BetSwirl affiliates:
- The SDK is fully sufficient. Use `ViemBetSwirlClient` or the function data pattern
- Set our wallet as the `affiliate` in `BetSwirlClientOptions` to earn affiliate revenue
- All game math, encoding/decoding, and bet history querying is handled

### What we already use from the SDK:
- ABIs (re-exported in `src/lib/casino/abis/*.ts`)
- Game entity classes (`Roulette.encodeInput()`, `Keno.encodeInput()`, etc.)
- Configuration parsers (`parseRawWeightedGameConfiguration`, `parseRawKenoConfiguration`)
- `getChainlinkVRFCost` function data pattern
- Cached Wheel/Plinko configurations

### What we could additionally leverage:
- `getPlaceBetFunctionData()` — Would simplify our hooks significantly
- `waitRolledBet()` — Built-in Roll event polling with timeout
- `fetchBets()` / `fetchBet()` — Subgraph-based bet history (replace our localStorage approach)
- `getBetRequirements()` — Proper max bet validation
- Freebet integration
- Leaderboard integration
