# UI Task: Chain Awareness, Network Switcher, and Dynamic Game Availability

## Problems to Fix

### 1. Header shows no chain indicator — balance is confusing without context
The header (`src/components/Header.tsx`) shows the native balance (e.g. "0 POL") but no chain name. Users can't tell what network they're on without checking MetaMask.

### 2. No way to switch chains from the header
There's no network switcher in the header. The only chain-switching UI is:
- `WrongNetworkBanner.tsx` — tells users to switch to Polygon (sports chain), which is wrong when they're in the casino section on Base/Avalanche
- Individual game components have a "Switch to Avalanche" button when on an unsupported chain

### 3. Casino page shows all 6 games as "Live" regardless of chain
`src/app/casino/page.tsx` has a static `GAMES` array where all 6 are `status: "live"`. But on Base, only CoinToss, Wheel, and Plinko are deployed. On Avalanche, only CoinToss is deployed. Dice, Roulette, and Keno only work on Polygon/Amoy.

---

## Changes Required

### 1. Add chain indicator + network switcher dropdown to the Header

**File:** `src/components/Header.tsx`

Add `useChainId` and `useSwitchChain` from wagmi. Between the address and the balance, add a small chain badge/dropdown that:
- Shows the current chain name (use a `CHAIN_NAMES` map: `137: "Polygon"`, `8453: "Base"`, `43114: "Avalanche"`, `100: "Gnosis"`, etc.)
- Clicking it opens a small dropdown to switch between supported chains
- Use the chains already configured in wagmi: Polygon, Base, Avalanche (and optionally Gnosis, Amoy, Fuji for dev)
- Style it to match the existing dark theme (zinc-800 borders, zinc-900 backgrounds, zinc-300 text)

The supported chains for the dropdown are defined in `src/wagmi.ts`:
```typescript
chains: [polygon, polygonAmoy, gnosis, avalanche, avalancheFuji, base]
```

For the dropdown, show only the mainnet chains to keep it clean: Polygon, Avalanche, Base. Optionally show testnets if you want.

**Current header layout** (right side): `[Odds dropdown] [My bets] [Address] [Balance] [Disconnect]`

**New layout**: `[Odds dropdown] [My bets] [Chain switcher] [Address] [Balance] [Disconnect]`

The chain switcher should be a small button/badge showing the chain name (e.g. "Base") with a dropdown on click showing the other chains.

### 2. Fix or remove the WrongNetworkBanner

**File:** `src/components/WrongNetworkBanner.tsx`

Currently it shows "Switch to Polygon" whenever you're NOT on Polygon (chain 137). This is wrong — Base and Avalanche are perfectly valid for casino.

**Option A (recommended):** Remove the banner entirely since the header now has a chain switcher. Remove it from `src/app/layout.tsx` too.

**Option B:** Make it smarter — only show it if the connected chain is not in the wagmi config's supported chains list at all.

### 3. Make casino game grid dynamic based on connected chain

**File:** `src/app/casino/page.tsx`

This is currently a server component with a static array. To make it chain-aware, it needs to become a client component (or extract the game grid into a client component).

The game grid should check which games have addresses configured for the current chain. Import the address getters and `isCasinoAddressConfigured` from `@/lib/casino/addresses`:

```typescript
import {
  getCasinoCoinTossAddress,
  getCasinoDiceAddress,
  getCasinoRouletteAddress,
  getCasinoKenoAddress,
  getCasinoWheelAddress,
  getCasinoPlinkoAddress,
  isCasinoAddressConfigured,
} from "@/lib/casino/addresses";
```

For each game, check if `isCasinoAddressConfigured(getAddress(chainId))` is true. If not, show it as "Coming Soon" or "Not available on [chain]" instead of "Live".

**Which games are available on which chains:**

| Game | Polygon (137) | Amoy (80002) | Gnosis (100) | Avalanche (43114) | Fuji (43113) | Base (8453) |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| CoinToss | BetSwirl | BetSwirl | env only | Our fork | Our fork | Our fork |
| Dice | BetSwirl | BetSwirl | env only | — | — | — |
| Roulette | BetSwirl | BetSwirl | env only | — | — | — |
| Keno | BetSwirl | BetSwirl | env only | — | — | — |
| Wheel | BetSwirl | BetSwirl | env only | — | — | Our fork |
| Plinko | BetSwirl | BetSwirl | env only | — | — | Our fork |

The `getCasino*Address(chainId)` functions already return `zeroAddress` for unconfigured games, so `isCasinoAddressConfigured()` handles this automatically.

When wallet is NOT connected, show all games as "Live" (they'll get the "connect wallet" or "switch network" prompt when they click through to a game page anyway).

### 4. Update game components' "Switch to Avalanche" fallback

**Files:** All 6 game components in `src/components/`:
- `CoinTossGame.tsx`
- `DiceGame.tsx`
- `RouletteGame.tsx`
- `KenoGame.tsx`
- `WheelGame.tsx`
- `PlinkoGame.tsx`

Each has a block like this when on an unsupported chain:
```tsx
<button onClick={() => switchChain?.({ chainId: avalanche.id })}>
  Switch to Avalanche
</button>
```

This should switch to the best chain for that game, not always Avalanche:
- For CoinToss: suggest Base (cheaper fees) or Avalanche
- For Wheel/Plinko: suggest Base (only chain besides Polygon with our deployment)
- For Dice/Roulette/Keno: suggest Polygon (only chain with deployments)

Or better: show a small chain picker with only the chains where that game is available.

---

## Key Files Reference

| File | What it does |
|------|-------------|
| `src/components/Header.tsx` | Top nav bar with wallet, balance, disconnect |
| `src/components/WrongNetworkBanner.tsx` | "Wrong network" bar above header |
| `src/app/layout.tsx` | Root layout, renders WrongNetworkBanner + Header |
| `src/app/casino/page.tsx` | Casino game grid (static GAMES array) |
| `src/lib/casino/addresses.ts` | All contract addresses + `getCasino*Address()` + `isCasinoAddressConfigured()` |
| `src/lib/casino/hooks.ts` | Game hooks with `canWager` logic |
| `src/wagmi.ts` | Wagmi config with supported chains |
| `src/lib/constants.ts` | `CHAIN_ID = 137` (Polygon default) |
| `src/components/CoinTossGame.tsx` | Example of game component with chain switching |

## Design Notes

- Keep the dark theme: `zinc-900` backgrounds, `zinc-800` borders, `zinc-300`/`zinc-400` text, `emerald-400`/`emerald-500` for active/positive states
- The chain switcher should be compact — a small pill/badge, not a big dropdown
- On mobile the header already gets crowded, so the chain switcher should be compact or collapse gracefully
- Use chain colors if you want: Polygon purple, Base blue, Avalanche red — but keep it subtle
