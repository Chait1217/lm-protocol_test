"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { hasRealWalletConnectProjectId } from "@/lib/wagmi";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Trade Demo", href: "/trade-demo" },
  { label: "Polygon Vault", href: "/base-vault" },
  { label: "Transactions", href: "/transactions" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending: isConnectPending } = useConnect();
  const { disconnectAsync, isPending: isDisconnectPending } = useDisconnect();
  const [connectError, setConnectError] = useState<string>("");

  const shortAddress = useMemo(() => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const handleInjectedButton = async () => {
    setConnectError("");
    try {
      if (isConnected) {
        await disconnectAsync();
        return;
      }
      await connectAsync({ connector: injected({ shimDisconnect: true }) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setConnectError(message);
    }
  };
  const isPending = isConnectPending || isDisconnectPending;

  return (
    <nav className="sticky top-0 z-50 border-b border-emerald-900/30 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shadow-glow">
              <span className="text-emerald-400 font-bold text-sm">LM</span>
            </div>
            <span className="hidden sm:block text-white font-semibold text-lg">
              Protocol
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Connect Wallet */}
          {hasRealWalletConnectProjectId ? (
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="address"
            />
          ) : (
            <div className="relative">
              <button
                onClick={handleInjectedButton}
                disabled={isPending}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? isConnected
                    ? "Disconnecting..."
                    : "Connecting..."
                  : isConnected && shortAddress
                  ? shortAddress
                  : "Connect Wallet"}
              </button>
              {connectError && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {connectError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
