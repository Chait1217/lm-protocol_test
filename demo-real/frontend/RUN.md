# How to run the frontend

## 1. Go to the frontend folder

From the repo root:

```bash
cd demo-real/frontend
```

(If you're already in `lm-protocol`, use `cd demo-real/frontend`. The app **must** be run from the `frontend` directory.)

## 2. Install dependencies

```bash
npm install
```

## 3. Environment file

Copy the example env and edit if needed:

```bash
cp .env.local.example .env.local
```

Minimum to run:

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` – get one at [WalletConnect Cloud](https://cloud.walletconnect.com) (free).
- Base contracts are optional for trade-demo; defaults exist for USDC. For vault/borrow you need:
  - `NEXT_PUBLIC_BASE_VAULT_ADDRESS`
  - `NEXT_PUBLIC_BASE_MARGIN_ENGINE_ADDRESS`

## 4. Start the dev server

```bash
npm run dev
```

Then open in your browser:

- **http://localhost:3000**  
  If you see "Port 3000 is in use", the app will use **http://localhost:3001** instead – open that.

## If you see "EMFILE: too many open files"

On macOS this often happens when the file-watcher limit is low. In the **same terminal** where you run `npm run dev`, raise the limit first:

```bash
ulimit -n 10240
npm run dev
```

To make it persistent for your user, add to `~/.zshrc` (or `~/.bashrc`):

```bash
ulimit -n 10240
```

Then open a new terminal and run `npm run dev` again.

## If the app still doesn’t start

- **Node version:** Use Node 18 or 20. Check with `node -v`.
- **Port in use:** Stop anything using port 3000 (or 3001), or run on another port:  
  `npm run dev -- -p 3002` then open http://localhost:3002
- **Build instead of dev:**  
  `npm run build && npm run start`  
  Then open http://localhost:3000
