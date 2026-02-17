# LM Protocol - Real Onchain Demo

A minimal but real onchain prototype of the LM Protocol: leveraged prediction markets with real USDC.e money flows on **Polygon PoS** — same chain as Polymarket.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐
│   User Wallet   │──────│   USDC.e         │
│  (MetaMask etc) │      │   (Polygon PoS)  │
└────────┬────────┘      └──────────────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌────────┐  ┌───────────────┐     ┌──────────────┐
│ Vault  │◄─│ MarginEngine  │────▶│  Polymarket  │
│(ERC4626)│  │ (Positions)   │     │  (CLOB API)  │
│        │──│               │     │              │
│- deposit │  │- openPosition │     │ Same chain!  │
│- withdraw│  │- closePosition│     │ No bridging  │
│- lend    │  │- liquidate    │     └──────────────┘
│- repay   │  │               │
└────────┘  └───────────────┘
```

**Key points:**
- **Single chain**: Vault + MarginEngine + Polymarket = all on Polygon PoS
- All USDC.e transfers are **real onchain** on Polygon
- No bridging needed — deposit, borrow, trade on the same network
- PnL is calculated with **mock prices** (user-provided entry/exit)
- In production, mock prices would be replaced by Polymarket oracle feeds

## User Benefits

```
✅ No bridging needed
✅ Single chain (Polygon)
✅ Vault + Polymarket + MarginEngine = same network
✅ Instant trades, no delays
✅ Cheaper gas (Polygon vs Base + bridge)
```

## Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Chain      | Polygon PoS mainnet (137)           |
| Token      | USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174) |
| Contracts  | Solidity ^0.8.20, Foundry, OpenZeppelin |
| Frontend   | Next.js 14, TypeScript, Tailwind    |
| Wallet     | RainbowKit + wagmi + viem           |

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)
- [Node.js](https://nodejs.org/) >= 18
- A wallet with MATIC/POL on Polygon PoS for gas

### 1. Clone & Install

```bash
cd demo-real

# Install Foundry dependencies
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Deploy to Polygon

```bash
cd demo-real/contracts

# 1. Set up environment
cp polygon.env .env
# Edit .env: set PRIVATE_KEY and POLYGON_RPC_URL

# 2. Source environment
source .env

# 3. Deploy vault + margin engine to Polygon
forge script script/DeployPolygonVault.s.sol --rpc-url $POLYGON_RPC_URL --broadcast

# 4. Copy logged addresses → frontend/.env.local
# The script will output:
#   NEXT_PUBLIC_USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
#   NEXT_PUBLIC_VAULT_ADDRESS=0x...
#   NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS=0x...
```

### 3. Configure Frontend

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo

# Polygon PoS mainnet
NEXT_PUBLIC_POLYGON_CHAIN_ID=137
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
NEXT_PUBLIC_VAULT_ADDRESS=0x...   # from deploy output
NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS=0x...   # from deploy output
NEXT_PUBLIC_CHAIN_ID=137
```

### 4. Run Frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Trade Flow

1. **Deposit USDC.e** into Polygon vault (`/base-vault`)
2. **Open position** → Borrow from vault → Real Polymarket trade (`/trade-demo`) — same chain!
3. **Live PnL tracking** with real Polymarket prices
4. **Close position** → Sell on Polymarket → Repay vault — all on Polygon

## Contract Details

### Vault (BaseVault.sol)

| Feature | Details |
|---------|---------|
| Token | ERC20 shares (bUSDC) |
| Asset | USDC.e on Polygon |
| Deposit | User sends USDC.e, receives shares proportional to TVL |
| Withdraw | Burn shares, receive USDC.e (subject to available liquidity) |
| Lending | MarginEngine borrows USDC.e for leveraged positions |
| Utilization Cap | 80% max (configurable) |
| Interest Split | 88% LP / 7% Insurance / 5% Protocol |

### MarginEngine (BaseMarginEngine.sol)

| Feature | Details |
|---------|---------|
| Leverage | 2x to 5x |
| Open Fee | 0.15% of notional (30% LP / 40% Insurance / 30% Protocol) |
| Borrow APR | Kink model: base=5%, slope1=15%, slope2=60%, kink=70% |
| Maintenance Margin | 10% of notional |
| Liquidation Penalty | 1% of remaining (50% keeper / 40% insurance / 10% protocol) |
| PnL | Mock prices (user-provided), real USDC.e settlement |

### Interest Rate Model

```
if utilization <= 70%:
    rate = 5% + 15% * (utilization / 70%)
else:
    rate = 20% + 60% * ((utilization - 70%) / 30%)
```

## Frontend Pages

### / (Home)
Overview with links to Trade Demo, Polygon Vault, and Margin Trade.

### /trade-demo
- Live Polymarket data + real USDC.e vault borrowing on Polygon
- Open leveraged positions (2-5x) and trade on Polymarket — single chain
- Live position tracking with PnL, liquidation distance
- Close positions: sell on Polymarket → close vault position — no chain switching

### /base-vault (Polygon Vault)
- Deposit/withdraw USDC.e on Polygon
- View TVL, utilization, borrowed amounts
- Insurance fund + protocol treasury

### /margin-trade
- Direct margin trading with mock prices
- Open/close positions with real USDC.e transfers

## Security Notes

This is a **prototype** for demonstration purposes:

- Contracts use ReentrancyGuard and Pausable
- No formal audit has been performed
- Not for production use with significant funds
- Mock prices are user-provided (no oracle)

## Next Steps (Production)

1. Integrate Polymarket oracle for real-time prices
2. Add Chainlink/UMA oracle for price feeds
3. Formal security audit
4. Timelock on admin functions
5. Keeper bot for liquidations
6. Subgraph for position indexing
