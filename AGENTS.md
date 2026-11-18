# Arc Climb

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Hill-climb moto game on Arc Testnet. Players pay a USDC entry fee per run; the farthest rider of each timed round wins the pot (pull-payment claim). Scores are self-reported and bounded by a 30 m/s plausibility cap (known testnet trust assumption).

Rename: the game is called Arc Climb (the pool contract is still named HillClimbPot).

Flow: landing screen, then Bike step, Map step, Ride step. Each run costs the pool's entry fee (0.1 USDC).

Bike shop: ArcClimbGarage at `0x15ecdd64578dcbf1e0ceb7338b091690bc06225e` (Arc Testnet), address in `.env` as `VITE_ARC_CLIMB_GARAGE_ADDRESS`. Bike ids match `src/game/bikes.ts`. Prices 0, 10, 50, 150, 500 USDC; upgrade step 2, 5, 15, 40, 100 USDC times next level (max level 3). Payments go straight from the buyer to the treasury `0x17968fbeD16710ED69535088151EC70acbA9B71b`; the contract holds no funds and has no admin.

Coins are an in-browser tally per wallet. They are not redeemable for USDC (no payout pool exists).

Deployed: HillClimbPot at `0x5878e70219b514398a63377df34a727b51724136` (Arc Testnet), address stored in `.env` as `VITE_HILL_CLIMB_ADDRESS`.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Composition root
- `src/game/` - physics engine and canvas renderer
- `src/hooks/useHillClimb.ts` - contract reads; `src/hooks/useWrites.ts` - transactions
- `src/lib/hillclimb.ts` - ABI, address, error parsing, glass styles
- `contracts/HillClimbPot.sol` - prize pool contract
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```
