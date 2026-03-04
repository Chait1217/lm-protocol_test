"use client";

import { useAccount } from "wagmi";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import {
  POLYMARKET_CLOB_API,
  POLYMKT_CTF_ADDRESS,
  POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS,
  POLYMKT_NEG_RISK_ADAPTER_ADDRESS,
} from "@/lib/polymarketConfig";

type PositionRow = {
  title?: string;
  slug?: string;
  outcome?: string;
  size?: number;
  avgPrice?: number;
  curPrice?: number;
  initialValue?: number;
  currentValue?: number;
  cashPnl?: number;
  /** Token ID for CLOB sell (from positions API "asset") */
  asset?: string;
  negativeRisk?: boolean;
};

export default function PolymarketPositionVerify() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [closing, setClosing] = useState(false);
  const [postingLimit, setPostingLimit] = useState(false);
  const [closeResult, setCloseResult] = useState<{ ok: boolean; message: string; txHash?: string } | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) {
      setPositions([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/polymarket-positions?user=${address}&size=20&t=${Date.now()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok || !j?.success) {
        throw new Error(j?.error || "Could not fetch Polymarket positions");
      }
      const raw = Array.isArray(j.positions) ? j.positions : [];
      setPositions(raw.map((p: Record<string, unknown>) => ({
        title: p.title as string | undefined,
        slug: p.slug as string | undefined,
        outcome: p.outcome as string | undefined,
        size: typeof p.size === "number" ? p.size : typeof p.size === "string" ? parseFloat(p.size) : undefined,
        avgPrice: typeof p.avgPrice === "number" ? p.avgPrice : typeof p.avgPrice === "string" ? parseFloat(p.avgPrice) : undefined,
        curPrice: typeof p.curPrice === "number" ? p.curPrice : undefined,
        initialValue: typeof p.initialValue === "number" ? p.initialValue : undefined,
        currentValue: typeof p.currentValue === "number" ? p.currentValue : undefined,
        cashPnl: typeof p.cashPnl === "number" ? p.cashPnl : undefined,
        asset: typeof p.asset === "string" ? p.asset : undefined,
        negativeRisk: typeof p.negativeRisk === "boolean" ? p.negativeRisk : true,
      })));
      setLastSync(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not fetch positions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const closePositionHere = useCallback(
    async (pos: PositionRow) => {
      const tokenId = pos?.asset;
      const size = pos?.size;
      if (!tokenId || size == null || size <= 0) {
        setCloseResult({ ok: false, message: "Missing asset or size for this position." });
        return;
      }
      if (typeof window === "undefined" || !window.ethereum) {
        setCloseResult({ ok: false, message: "No wallet (e.g. MetaMask) found." });
        return;
      }
      setCloseResult(null);
      setClosing(true);
      try {
        const { ethers } = await import("ethers");
        const { ClobClient, Side, OrderType } = await import("@polymarket/clob-client");
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const walletAddress = await signer.getAddress();
        if (walletAddress?.toLowerCase() !== address?.toLowerCase()) {
          setCloseResult({ ok: false, message: "Connected wallet does not match this position. Switch wallet and try again." });
          setClosing(false);
          return;
        }
        const host = POLYMARKET_CLOB_API;
        const baseClient = new ClobClient(host, 137, signer);
        const creds = await baseClient.createOrDeriveApiKey();
        const client = new ClobClient(host, 137, signer, creds, 0, walletAddress);
        const { AssetType } = await import("@polymarket/clob-client");

        // Approve CTF (ERC-1155) so Polymarket can transfer outcome tokens when selling
        const ctfAbi = [
          "function setApprovalForAll(address operator, bool approved) external",
          "function isApprovedForAll(address account, address operator) view returns (bool)",
        ];
        const ctf = new ethers.Contract(POLYMKT_CTF_ADDRESS, ctfAbi, signer);
        const operators = [POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS, POLYMKT_NEG_RISK_ADAPTER_ADDRESS];
        for (const op of operators) {
          const approved = await ctf.isApprovedForAll(walletAddress, op);
          if (!approved) {
            const tx = await ctf.setApprovalForAll(op, true);
            await tx.wait(1);
          }
        }
        // Refresh CLOB view of both collateral and conditional balances
        await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        await client.updateBalanceAllowance({ asset_type: AssetType.CONDITIONAL, token_id: tokenId });
        await new Promise((r) => setTimeout(r, 1500));

        const tickSize: "0.1" | "0.01" | "0.001" | "0.0001" = "0.01";
        const negRisk = pos.negativeRisk ?? true;
        const amount = Number(size);
        const hasSuccess = (r: any) => {
          const status = (r?.status ?? r?.errorMsg ?? r?.error ?? "").toString().toLowerCase();
          if (["matched", "filled", "live", "accepted", "posted", "open"].some((s) => status.includes(s))) return true;
          if (r?.success === true) return true;
          const id = r?.orderID ?? r?.orderId ?? r?.id ?? r?.order_id;
          const tx = r?.transactionHash ?? r?.txHash ?? r?.transaction_hash ?? (Array.isArray(r?.transactionHashes) ? r.transactionHashes?.[0] : undefined);
          return Boolean(id || tx);
        };

        let resp: any;
        try {
          resp = await client.createAndPostMarketOrder(
            { tokenID: tokenId, amount, side: Side.SELL },
            { tickSize, negRisk },
            OrderType.FOK
          );
        } catch (fokErr: unknown) {
          const msg = fokErr instanceof Error ? fokErr.message : String(fokErr);
          if (
            msg.toLowerCase().includes("fully filled") ||
            msg.toLowerCase().includes("couldn't be fully filled") ||
            msg.toLowerCase().includes("no orders found to match") ||
            msg.toLowerCase().includes("no orders found")
          ) {
            resp = await client.createAndPostMarketOrder(
              { tokenID: tokenId, amount, side: Side.SELL },
              { tickSize, negRisk },
              OrderType.FAK
            );
          } else {
            throw fokErr;
          }
        }

        if (!hasSuccess(resp)) {
          const errMsg = (resp?.errorMsg ?? resp?.error ?? resp?.message ?? "No fill").toString();
          setCloseResult({ ok: false, message: `Instant sell did not fill: ${errMsg}. Try "Post limit sell" below or try again later.` });
          setClosing(false);
          return;
        }

        const orderId = resp?.orderID ?? resp?.id ?? resp?.order_id;
        const txHash = resp?.transactionHash ?? resp?.txHash ?? resp?.transaction_hash ?? (Array.isArray(resp?.transactionHashes) ? resp.transactionHashes[0] : undefined);
        const hashStr = typeof txHash === "string" ? txHash : undefined;
        setCloseResult({
          ok: true,
          message: hashStr ? "Position closed. Transaction submitted." : orderId ? `Position closed. Order ID: ${String(orderId).slice(0, 20)}…` : "Position closed.",
          txHash: hashStr,
        });
        fetchPositions();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setCloseResult({ ok: false, message: message.length > 200 ? message.slice(0, 200) + "…" : message });
      } finally {
        setClosing(false);
      }
    },
    [address, fetchPositions]
  );

  const postLimitSell = useCallback(
    async (pos: PositionRow) => {
      const tokenId = pos?.asset;
      const size = pos?.size;
      if (!tokenId || size == null || size <= 0) {
        setCloseResult({ ok: false, message: "Missing asset or size." });
        return;
      }
      if (typeof window === "undefined" || !window.ethereum) {
        setCloseResult({ ok: false, message: "No wallet found." });
        return;
      }
      setCloseResult(null);
      setPostingLimit(true);
      try {
        const { ethers } = await import("ethers");
        const { ClobClient, Side, OrderType } = await import("@polymarket/clob-client");
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const walletAddress = await signer.getAddress();
        if (walletAddress?.toLowerCase() !== address?.toLowerCase()) {
          setCloseResult({ ok: false, message: "Connected wallet does not match. Switch wallet." });
          setPostingLimit(false);
          return;
        }
        const host = POLYMARKET_CLOB_API;
        const baseClient = new ClobClient(host, 137, signer);
        const creds = await baseClient.createOrDeriveApiKey();
        const client = new ClobClient(host, 137, signer, creds, 0, walletAddress);
        const { AssetType } = await import("@polymarket/clob-client");

        // Approve CTF (ERC-1155) so Polymarket can transfer outcome tokens when selling
        const ctfAbi = [
          "function setApprovalForAll(address operator, bool approved) external",
          "function isApprovedForAll(address account, address operator) view returns (bool)",
        ];
        const ctf = new ethers.Contract(POLYMKT_CTF_ADDRESS, ctfAbi, signer);
        const operators = [POLYMKT_NEG_RISK_CTF_EXCHANGE_ADDRESS, POLYMKT_NEG_RISK_ADAPTER_ADDRESS];
        for (const op of operators) {
          const approved = await ctf.isApprovedForAll(walletAddress, op);
          if (!approved) {
            const tx = await ctf.setApprovalForAll(op, true);
            await tx.wait(1);
          }
        }
        // Refresh CLOB view of both collateral and conditional balances
        await client.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        await client.updateBalanceAllowance({ asset_type: AssetType.CONDITIONAL, token_id: tokenId });
        await new Promise((r) => setTimeout(r, 1500));

        const tickSize: "0.1" | "0.01" | "0.001" | "0.0001" = "0.01";
        const negRisk = pos.negativeRisk ?? true;
        const price = Math.max(0.01, Math.min(0.99, (pos.curPrice ?? pos.avgPrice ?? 0.26)));
        const orderSize = Number(size);
        const resp = await client.createAndPostOrder(
          { tokenID: tokenId, price, size: orderSize, side: Side.SELL },
          { tickSize, negRisk },
          OrderType.GTC
        );
        const orderId = resp?.orderID ?? resp?.id ?? resp?.order_id;
        const txHash = resp?.transactionHash ?? resp?.txHash;
        const status = (resp?.status ?? resp?.errorMsg ?? resp?.error ?? "").toString().toLowerCase();
        const ok = Boolean(orderId || txHash || ["matched", "filled", "live", "posted", "open"].some((s) => status.includes(s)));
        if (ok) {
          setCloseResult({
            ok: true,
            message: orderId ? "Limit sell order posted. It may fill when someone buys. Check Polymarket or refresh." : "Order posted.",
            txHash: typeof txHash === "string" ? txHash : undefined,
          });
          fetchPositions();
        } else {
          setCloseResult({ ok: false, message: (resp?.errorMsg ?? resp?.error ?? "Failed to post order").toString() });
        }
      } catch (err: unknown) {
        setCloseResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
      } finally {
        setPostingLimit(false);
      }
    },
    [address, fetchPositions]
  );

  const fetchRef = useRef(fetchPositions);
  fetchRef.current = fetchPositions;

  useEffect(() => {
    fetchRef.current();
    const id = setInterval(() => fetchRef.current(), 6000);
    return () => clearInterval(id);
  }, [fetchPositions]);

  if (!isConnected) return null;

  const top = positions[0];
  const marketUrl =
    top?.slug && top.slug.length > 0
      ? `https://polymarket.com/market/${top.slug}`
      : "https://polymarket.com/portfolio";

  return (
    <div className="glass-card rounded-xl border border-emerald-500/20 shadow-glow p-2.5 mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-white font-semibold text-[10px] flex items-center gap-1">
          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
          Verify on Polymarket API
        </h4>
        <button
          type="button"
          onClick={() => fetchPositions()}
          disabled={loading}
          className="text-gray-400 hover:text-emerald-400 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <p className="text-red-300 text-[10px]">{error}</p>
      ) : positions.length === 0 ? (
        <p className="text-gray-500 text-[10px]">
          No open positions returned by Polymarket API for this wallet.
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="rounded border border-emerald-900/30 bg-black/40 p-2 text-[10px]">
            <div className="text-white font-semibold truncate" title={top?.title || ""}>
              {top?.title || "Open position"}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span className="text-gray-400">Outcome</span>
              <span className="text-emerald-300">{top?.outcome ?? "--"}</span>
              <span className="text-gray-400">Size</span>
              <span className="text-gray-200">{top?.size != null ? top.size.toFixed(4) : "--"}</span>
              <span className="text-gray-400">Entry (avg price)</span>
              <span className="text-emerald-300 font-mono">{top?.avgPrice != null ? `${(top.avgPrice * 100).toFixed(2)}¢` : "--"}</span>
              <span className="text-gray-400">Current value</span>
              <span className="text-gray-200">${top?.currentValue != null ? top.currentValue.toFixed(4) : "--"}</span>
              <span className="text-gray-400">PnL</span>
              <span className={`${(top?.cashPnl ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {top?.cashPnl != null ? `${top.cashPnl >= 0 ? "+" : ""}$${top.cashPnl.toFixed(4)}` : "--"}
              </span>
            </div>
          </div>
          <p className="text-[9px] text-gray-500">
            If no popup appears, ensure Polygon is selected in your wallet. Success only when you see a green message and/or a Polygonscan link.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => closePositionHere(top)}
              disabled={closing || postingLimit || !top?.asset || (top?.size ?? 0) <= 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 py-1.5 px-2.5 text-[10px] font-semibold hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {closing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              {closing ? "Closing…" : "Close now (instant sell, sign in wallet)"}
            </button>
            <button
              type="button"
              onClick={() => postLimitSell(top)}
              disabled={closing || postingLimit || !top?.asset || (top?.size ?? 0) <= 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 py-1.5 px-2.5 text-[10px] font-semibold hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {postingLimit ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {postingLimit ? "Posting…" : "Post limit sell (resting order)"}
            </button>
            <a
              href={marketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:underline"
            >
              Open on Polymarket <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-[9px] text-gray-500">
            If instant close fails (no liquidity), use <strong>Post limit sell</strong>: you sign once and the order rests on the book until it fills.
          </p>
          {closeResult && (
            <div
              className={`text-[10px] mt-1.5 p-1.5 rounded border ${
                closeResult.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              <div>{closeResult.message}</div>
              {closeResult.ok && closeResult.txHash && (
                <a
                  href={`https://polygonscan.com/tx/${closeResult.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-emerald-400 hover:underline"
                >
                  View on Polygonscan <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {closeResult.ok && !closeResult.txHash && address && (
                <a
                  href={`https://polygonscan.com/address/${address}#internaltx`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-emerald-400 hover:underline"
                >
                  View wallet on Polygonscan (find your tx here) <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-[9px] text-gray-500 mt-1.5">
        Source: data-api.polymarket.com for wallet {address?.slice(0, 6)}...{address?.slice(-4)}
        {lastSync ? ` · synced ${lastSync.toLocaleTimeString()}` : ""}
      </p>
    </div>
  );
}

