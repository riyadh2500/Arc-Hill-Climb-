# Arc Climb

A browser hill-climb moto game with a USDC prize pot on Arc Testnet. Pick a bike, pick a map, pay 0.1 USDC per run, and ride as far as you can. The farthest rider in each timed round wins the whole pot.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Start from the stunt screen and enter with one click.
- Choose from five bikes. ARC Bike is free; four more can be bought with USDC, and every bike can be upgraded up to level 3. Better bikes are faster and more efficient.
- Your garage is saved to your wallet address, so reconnecting the same wallet on any device brings your bikes and upgrades back.
- Choose from four animated maps: Green Meadow, Sun Dunes, Frozen Peaks and Moon Craters (low gravity). Easier maps multiply your score by a factor below 1 so no map out-scores another on distance alone.
- The ride fills the whole screen (it also asks the browser for real full screen). The pot, standings and claim appear only after a run ends.
- Collect coins while riding. Coins are a tally kept in your browser for each wallet.
- Connect with any browser wallet or Coinbase Wallet.

## Tech stack

- React, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- Solidity and Foundry (contracts in `contracts/`)
- Canvas 2D game engine (`src/game/`)

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev
```

Other commands:

```bash
bun run check            # lint and typecheck
bun run contracts:build  # compile the contracts
bun run contracts:test   # run contract tests
```

### Environment variables

- `VITE_HILL_CLIMB_ADDRESS`: address of the deployed prize pool contract on Arc Testnet.
- `VITE_ARC_CLIMB_GARAGE_ADDRESS`: address of the deployed bike shop contract on Arc Testnet.

Both are public addresses. `.env.production` already holds them for production builds (for example on Vercel); put them in `.env` for local development.
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: optional outside Arc Studio. Provisioned by Arc Studio for backend RPC access.
