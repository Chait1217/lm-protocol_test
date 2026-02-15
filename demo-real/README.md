# LM Protocol - Real Onchain Demo

A minimal but real onchain prototype of the LM Protocol: leveraged prediction markets with real USDC money flows on Polygon.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐
│   User Wallet   │──────│   MockUSDC.sol   │
│  (MetaMask etc) │      │   (ERC20 faucet) │
└────────┬────────┘      └──────────────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌────────┐  ┌───────────────┐
│ Vault  │◄─│ MarginEngine  │
│ (ERC4626) │  │ (Positions)   │
│        │──│               │
│ - deposit  │  │ - openPosition │
│ - withdraw │  │ - closePosition│
│ - lend     │  │ - liquidate    │
│ - repay    │  │               │
└────────┘  └───────────────┘
```

**Key points:**
- All USDC transfers are **real onchain** (testnet or mainnet)
- PnL is calculated with **mock prices** (user-provided entry/exit)
- Vault lending, interest, and fee distribution are fully functional
- In production, mock prices would be replaced by Polymarket oracle feeds

## Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Chain      | Polygon (Amoy testnet / Mainnet)    |
| Contracts  | Solidity ^0.8.20, Foundry, OpenZeppelin |
| Frontend   | Next.js 14, TypeScript, Tailwind    |
| Wallet     | RainbowKit + wagmi + viem           |

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)
- [Node.js](https://nodejs.org/) >= 18
- A wallet with Polygon Amoy testnet POL for gas

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

### 2. Local Development (Anvil Fork)

#### Start local Anvil node

```bash
cd contracts
anvil --fork-url https://rpc-amoy.polygon.technology --chain-id 31337
```

#### Deploy contracts locally

In a new terminal:

```bash
cd contracts
cp .env.example .env
# Edit .env: set PRIVATE_KEY to one of Anvil's test accounts
# e.g. PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

source .env
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Note the deployed addresses from the output.

#### Start frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with the contract addresses from deployment output:
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
# NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
# NEXT_PUBLIC_VAULT_ADDRESS=0x...
# NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS=0x...
# NEXT_PUBLIC_CHAIN_ID=31337  (or 80002 for Amoy)

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Deploy to Polygon Amoy Testnet

#### Get testnet POL

1. Go to [Polygon Amoy Faucet](https://faucet.polygon.technology/)
2. Request POL for the Amoy testnet
3. Import your wallet into MetaMask with Amoy network:
   - RPC: `https://rpc-amoy.polygon.technology`
   - Chain ID: `80002`
   - Symbol: `POL`
   - Explorer: `https://amoy.polygonscan.com`

#### Deploy

```bash
cd contracts
cp .env.example .env
# Edit .env with your real private key and Amoy RPC URL

source .env
forge script script/Deploy.s.sol \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

#### Verify contracts (if not auto-verified)

```bash
forge verify-contract <MOCK_USDC_ADDRESS> src/MockUSDC.sol:MockUSDC \
  --chain-id 80002 \
  --etherscan-api-key $POLYGONSCAN_API_KEY

forge verify-contract <VAULT_ADDRESS> src/Vault.sol:Vault \
  --chain-id 80002 \
  --constructor-args $(cast abi-encode "constructor(address)" <MOCK_USDC_ADDRESS>) \
  --etherscan-api-key $POLYGONSCAN_API_KEY

forge verify-contract <MARGIN_ENGINE_ADDRESS> src/MarginEngine.sol:MarginEngine \
  --chain-id 80002 \
  --constructor-args $(cast abi-encode "constructor(address,address)" <MOCK_USDC_ADDRESS> <VAULT_ADDRESS>) \
  --etherscan-api-key $POLYGONSCAN_API_KEY
```

### 4. Getting Test USDC

The MockUSDC contract has a `faucet()` function:

```bash
# Via CLI
cast send <MOCK_USDC_ADDRESS> "faucet(address,uint256)" <YOUR_WALLET> 10000000000 \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --private-key $PRIVATE_KEY

# Or just use the "Faucet" button in the frontend UI
```

Each call mints up to 10,000 USDC (6 decimals: `10000000000` = 10,000 USDC).

### 5. Run Tests

```bash
cd contracts
forge test -vvv
```

## Contract Details

### Vault.sol

| Feature | Details |
|---------|---------|
| Token | ERC20 shares (lmUSDC) |
| Deposit | User sends USDC, receives shares proportional to TVL |
| Withdraw | Burn shares, receive USDC (subject to available liquidity) |
| Lending | MarginEngine borrows USDC for leveraged positions |
| Utilization Cap | 80% max |
| Per-Position Cap | 0.25% of TVL |
| Per-Wallet Cap | 1% of TVL |
| Interest Split | 88% LP / 7% Insurance / 5% Protocol |

### MarginEngine.sol

| Feature | Details |
|---------|---------|
| Leverage | 2x to 10x |
| Open Fee | 0.15% of notional (30% LP / 40% Insurance / 30% Protocol) |
| Borrow APR | Kink model: base=5%, slope1=15%, slope2=60%, kink=70% |
| Maintenance Margin | 5% of notional |
| Liquidation Penalty | 1% of remaining (50% keeper / 40% insurance / 10% protocol) |
| PnL | Mock prices (user-provided), real USDC settlement |

### Interest Rate Model

```
if utilization <= 70%:
    rate = 5% + 15% * (utilization / 70%)
else:
    rate = 20% + 60% * ((utilization - 70%) / 30%)
```

## Frontend Pages

### / (Home)
Overview with links to Vault and Trade Demo.

### /vault
- Connect wallet (RainbowKit)
- View real Vault TVL, utilization, borrowed
- Deposit USDC (approve + deposit)
- Withdraw USDC
- View insurance fund + protocol treasury
- Testnet USDC faucet

### /trade-demo
- Set collateral, leverage (2-10x), direction (Long/Short)
- Set mock entry and exit prices
- Open position (real USDC transfer + vault borrow)
- Close position (real repayment + PnL settlement)
- View live vault stats, fee distribution, borrow APR
- Educational explanation of money flow

## Project Structure

```
demo-real/
├── contracts/                 # Foundry project
│   ├── src/
│   │   ├── MockUSDC.sol      # Test USDC with faucet
│   │   ├── Vault.sol         # ERC4626-like USDC vault
│   │   ├── MarginEngine.sol  # Leveraged position engine
│   │   └── interfaces/
│   │       └── IVault.sol
│   ├── script/
│   │   └── Deploy.s.sol      # Deployment script
│   ├── test/
│   │   └── Vault.t.sol       # Unit tests
│   ├── foundry.toml
│   └── .env.example
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── layout.tsx        # Root layout + providers
│   │   ├── page.tsx          # Home page
│   │   ├── vault/page.tsx    # Vault page
│   │   └── trade-demo/page.tsx # Trade demo page
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── TxButton.tsx
│   │   └── StatCard.tsx
│   ├── lib/
│   │   ├── contracts.ts      # ABIs + addresses
│   │   ├── wagmi.ts          # Wagmi + RainbowKit config
│   │   └── utils.ts          # Formatting helpers
│   ├── package.json
│   ├── tailwind.config.ts
│   └── .env.local.example
└── README.md
```

## Security Notes

This is a **prototype** for demonstration purposes:

- Contracts use ReentrancyGuard and Pausable
- `tx.origin` is used for per-wallet tracking (acceptable for demo, not production)
- No formal audit has been performed
- Not for production use with real funds
- Mock prices are user-provided (no oracle)

## Next Steps (Production)

1. Replace MockUSDC with real USDC.e/USDC on Polygon
2. Integrate Polymarket CLOB API for real prices
3. Add Chainlink/UMA oracle for price feeds
4. Formal security audit
5. Timelock on admin functions
6. Keeper bot for liquidations
7. Subgraph for position indexing
