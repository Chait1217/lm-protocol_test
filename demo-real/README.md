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

### 2. Environment Variables

**Backend (Foundry) – `contracts/.env`**

```env
# Required for deployment to Polygon Amoy
PRIVATE_KEY=0x...                    # Your wallet private key (e.g. deployer)
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Optional: for contract verification
POLYGONSCAN_API_KEY=...
```

**Frontend – `frontend/.env.local`**

```env
# Chain: 80002 = Polygon Amoy (real testnet vault)
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology

# Deployed contract addresses (copy from deploy script output)
NEXT_PUBLIC_USDC_ADDRESS=0x...       # MockUSDC (or real USDC on mainnet)
NEXT_PUBLIC_VAULT_ADDRESS=0x...      # Vault

# Optional: if you use MarginEngine on this demo
NEXT_PUBLIC_MARGIN_ENGINE_ADDRESS=0x...

# WalletConnect (get one at https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

**Frontend – Base mainnet vault (`/base-vault`, `/trade-demo`)** – add to `.env.local`:

```env
NEXT_PUBLIC_BASE_CHAIN_ID=8453
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_BASE_VAULT_ADDRESS=0x...   # From DeployBaseVault script output
NEXT_PUBLIC_BASE_MARGIN_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

**Frontend – Polygon + Polymarket (real trade on `/trade-demo`)** – optional, for “Real Polymarket trade”:

```env
NEXT_PUBLIC_POLYGON_CHAIN_ID=137
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_POLYMKT_USDCE_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
NEXT_PUBLIC_POLYMKT_CTF_ADDRESS=0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
NEXT_PUBLIC_POLYMKT_CTF_EXCHANGE_ADDRESS=0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E
```

You need USDC/USDC.e on Polygon in the same wallet to place real Polymarket orders (bridge or send from an exchange).

### 3. How to run the deployment locally (Polygon Amoy)

Exact CLI steps:

1. **Set up `contracts/.env`** with:

   ```env
   PRIVATE_KEY=0x<your_hex_private_key>
   POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   ```

2. **Run the vault-only deploy script** (MockUSDC + Vault only; no MarginEngine):

   ```bash
   cd demo-real/contracts
   source .env   # or: export $(cat .env | xargs)
   forge script script/DeployVault.s.sol:DeployVaultScript --rpc-url polygon_amoy --broadcast
   ```
   (`polygon_amoy` in foundry.toml uses `POLYGON_AMOY_RPC_URL` from .env.)

3. **Copy the logged addresses** from the output:

   - `USDC_ADDRESS` → use as `NEXT_PUBLIC_USDC_ADDRESS` (and optionally `NEXT_PUBLIC_MOCK_USDC_ADDRESS`) in frontend `.env.local`
   - `VAULT_ADDRESS` → use as `NEXT_PUBLIC_VAULT_ADDRESS` in frontend `.env.local`

4. **Frontend**: set `NEXT_PUBLIC_CHAIN_ID=80002`, `NEXT_PUBLIC_RPC_URL`, and the two addresses above in `frontend/.env.local`, then run `npm run dev`. The `/vault` page will use the real onchain vault; `/trade-demo` vault stats will read from the same Vault contract.

### 3b. Deploy BaseVault to Base mainnet (native USDC)

The Base vault uses **canonical native USDC** on Base (no MockUSDC). Chain id: **8453**.

1. **Set up `contracts/.env`** with:

   ```env
   PRIVATE_KEY=0x<your_hex_private_key>
   BASE_MAINNET_RPC_URL=https://mainnet.base.org
   ```

2. **Deploy the vault**:

   ```bash
   cd demo-real/contracts
   source .env   # or: export $(cat .env | xargs)
   forge script script/DeployBaseVault.s.sol:DeployBaseVault --rpc-url $BASE_MAINNET_RPC_URL --broadcast
   ```

   Or using the named endpoint (foundry.toml has `base = "${BASE_MAINNET_RPC_URL}"`):

   ```bash
   forge script script/DeployBaseVault.s.sol:DeployBaseVault --rpc-url base --broadcast
   ```

3. **Copy the logged vault address** into frontend `.env.local` as `NEXT_PUBLIC_BASE_VAULT_ADDRESS`. USDC address is fixed: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. See frontend env section for Base below.

### 4. Local Development (Anvil Fork)

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
# Vault-only (no MarginEngine): use DeployVault.s.sol
forge script script/DeployVault.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# Or full stack (Vault + MarginEngine): use Deploy.s.sol
# forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
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

### 6. Getting Test USDC

The MockUSDC contract has a `faucet()` function:

```bash
# Via CLI
cast send <MOCK_USDC_ADDRESS> "faucet(address,uint256)" <YOUR_WALLET> 10000000000 \
  --rpc-url $POLYGON_AMOY_RPC_URL \
  --private-key $PRIVATE_KEY

# Or just use the "Faucet" button in the frontend UI
```

Each call mints up to 10,000 USDC (6 decimals: `10000000000` = 10,000 USDC).

### 7. Run Tests

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
- **Simulated PnL**: Set collateral, leverage (2-10x), direction (Long/Short); open/close positions on Base vault with real USDC; PnL is simulated from entry/exit prices.
- **Real Polymarket trade**: Switch to Polygon, use USDC.e in the same wallet to place a real order on Polymarket (BTC 100k market) via the CLOB API; includes warning and confirmation modal.
- Live Polymarket quotes and order book; vault stats, fee distribution, borrow APR.

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
