# Debugging "Trade not working on Polymarket"

When asking others for help debugging Polymarket trade failures, share the following:

---

## 1. Relevant Files (as-is)

Include these files in your report (contents as-is, no modifications):

| File | Purpose |
|------|---------|
| `components/RealPolymarketTrade.tsx` | Main trade execution component |
| `components/PolymarketLeverageBox.tsx` | Parent UI that calls RealPolymarketTrade |
| `lib/polymarketConfig.ts` | Chain, CLOB, CTF addresses |
| `lib/contracts.ts` | Contract address resolution |
| `lib/polymarketAbi.ts` | ABIs for USDC, CTF, Exchange |
| `app/api/clob-proxy/[...path]/route.ts` | CLOB API proxy (if used) |
| `app/trade-demo/page.tsx` | Trade Demo page |

---

## 2. Environment: `.env.local` (redacted)

Share your **NEXT_PUBLIC_*** Polymarket and RPC settings **with secrets redacted**:

```env
# WalletConnect (required for wagmi)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=***REDACTED***

# Polygon – Polymarket execution
NEXT_PUBLIC_POLYGON_CHAIN_ID=137
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_RPC_ALLOW_PUBLIC_FALLBACK=true

# Polymarket contracts (Polygon)
NEXT_PUBLIC_POLYMKT_USDCE_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
NEXT_PUBLIC_POLYMKT_CTF_ADDRESS=0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
NEXT_PUBLIC_POLYMKT_CTF_EXCHANGE_ADDRESS=0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E
NEXT_PUBLIC_POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS=0xC5d563A36AE78145C45a50134d48A1215220f80a
NEXT_PUBLIC_POLYMKT_NEG_RISK_ADAPTER_ADDRESS=0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296

# CLOB API (default: https://clob.polymarket.com, or proxy)
NEXT_PUBLIC_POLYMARKET_CLOB_API=https://clob.polymarket.com

# Optional overrides
NEXT_PUBLIC_POLYMARKET_NO_LIQUIDITY_MODE=abort
NEXT_PUBLIC_POLYMARKET_EXECUTION_MODE=market_first
```

**Do not share:**
- `POLYMARKET_FEED_PRIVATE_KEY`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (actual value – just say "set" or "***REDACTED***")

---

## 3. Description of the problem

Provide a short description:

- **What happens when you click "Execute trade"?**
  - e.g. "Button spins, then shows error", "No response", "Transaction confirms but position never appears"

---

## 4. UI error text

Copy the **exact error text** from the **RealPolymarketTrade** result box (success/error area below the Execute button).

---

## 5. Console logs

Open DevTools (F12) → Console, then run the trade. Copy any lines like:

- `[Polymarket][orderbook-snapshot] …`
- Other `[Polymarket]` prefixed logs

---

## 6. Raw error string

If you see a message starting with:

```text
Polymarket order failed: …
```

copy the **full raw error string** (it often includes allowance/balance details like `need=… balance=… clobAllowance=…`).

---

## 7. Minimal repro package (optional)

To create a minimal repro you can drop into a GitHub gist or pastebin:

### Files to include

```
demo-real/frontend/
├── .env.local.example          # (rename to .env.local and fill; redact secrets when sharing)
├── components/
│   ├── RealPolymarketTrade.tsx
│   ├── PolymarketLeverageBox.tsx
│   └── ...
├── lib/
│   ├── polymarketConfig.ts
│   ├── contracts.ts
│   ├── polymarketAbi.ts
│   ├── utils.ts
│   └── ...
├── app/
│   ├── trade-demo/page.tsx
│   ├── api/clob-proxy/[...path]/route.ts
│   ├── layout.tsx
│   └── providers.tsx
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── RUN.md
└── DEBUG_POLYMARKET_TRADE.md   # this file
```

### Instructions for others

1. `cd demo-real/frontend`
2. `npm install`
3. `cp .env.local.example .env.local`
4. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (get one at [WalletConnect Cloud](https://cloud.walletconnect.com))
5. Ensure Polygon RPC vars are set (see `.env.local.example`)
6. `npm run dev`
7. Open http://localhost:3000 → go to Trade Demo
8. Connect wallet on Polygon, fund with USDC.e, then try Execute trade

### Creating the repro zip

From the repo root:

```bash
cd demo-real/frontend
zip -r polymarket-trade-repro.zip \
  components/RealPolymarketTrade.tsx \
  components/PolymarketLeverageBox.tsx \
  lib/polymarketConfig.ts \
  lib/contracts.ts \
  lib/polymarketAbi.ts \
  lib/utils.ts \
  app/trade-demo/page.tsx \
  app/api/clob-proxy \
  app/layout.tsx \
  app/providers.tsx \
  package.json \
  next.config.ts \
  tailwind.config.ts \
  RUN.md \
  DEBUG_POLYMARKET_TRADE.md \
  .env.local.example
```

Or create a **GitHub gist** with:
- One file per component/lib (or a single paste with clear section headers)
- A `README` with the instructions above and your redacted `.env.local` snippet

---

## Quick checklist before asking for help

- [ ] Wallet is connected on **Polygon** (chain 137)
- [ ] You have **USDC.e** (not native USDC) on Polygon
- [ ] You have approved USDC.e for the CLOB/Exchange/CTF contracts (first trade may require multiple approvals)
- [ ] Polygon RPC is reachable (try `https://polygon-rpc.com` or an Alchemy/Infura URL)
- [ ] No ad blocker / extension is blocking requests to `clob.polymarket.com` or your proxy
