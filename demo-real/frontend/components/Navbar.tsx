"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { hasRealWalletConnectProjectId } from "@/lib/wagmi";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Trade", href: "/trade-demo" },
  { label: "Vault", href: "/base-vault" },
  { label: "History", href: "/transactions" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending: isConnectPending } = useConnect();
  const { disconnectAsync, isPending: isDisconnectPending } = useDisconnect();
  const [connectError, setConnectError] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? "text-[#00ff88] bg-[#00ff88]/8"
                : "text-[#888] hover:text-white hover:bg-white/5"
            }`}
          >
            {item.label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-[#00ff88] rounded-full" />
            )}
          </Link>
        );
      })}
    </>
  );

  const WalletButton = () => {
    if (hasRealWalletConnectProjectId) {
      return <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />;
    }
    return (
      <div className="relative">
        <button
          onClick={handleInjectedButton}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl border border-[#00ff88]/30 bg-[#00ff88]/8 px-4 py-2.5 text-sm font-semibold text-[#00ff88] transition-all hover:bg-[#00ff88]/15 hover:border-[#00ff88]/50 hover:shadow-[0_0_20px_rgba(0,255,136,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <div className="spinner" />
              {isConnected ? "Disconnecting..." : "Connecting..."}
            </>
          ) : isConnected && shortAddress ? (
            <>
              <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse-neon" />
              <span className="mono">{shortAddress}</span>
            </>
          ) : (
            "Connect Wallet"
          )}
        </button>
        {connectError && (
          <div className="absolute right-0 mt-2 w-72 rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-lg px-4 py-3 text-xs text-red-300 z-50">
            {connectError}
          </div>
        )}
      </div>
    );
  };

  if (!mounted) {
    return (
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#00ff88]/20 to-[#00ff88]/5 flex items-center justify-center border border-[#00ff88]/20">
                <span className="text-[#00ff88] font-bold text-sm">LM</span>
              </div>
              <span className="hidden sm:block text-white font-semibold text-lg tracking-tight">Protocol</span>
            </Link>
            <button disabled className="rounded-xl border border-[#00ff88]/20 bg-[#00ff88]/5 px-4 py-2.5 text-sm font-medium text-[#00ff88]/50 cursor-not-allowed">
              Connect Wallet
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#00ff88]/20 to-[#00ff88]/5 flex items-center justify-center border border-[#00ff88]/20 group-hover:border-[#00ff88]/40 group-hover:shadow-[0_0_15px_rgba(0,255,136,0.1)] transition-all">
              <span className="text-[#00ff88] font-bold text-sm">LM</span>
            </div>
            <span className="hidden sm:block text-white font-semibold text-lg tracking-tight">Protocol</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 bg-white/[0.02] rounded-2xl p-1 border border-white/5">
            <NavLinks />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <WalletButton />
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-white/5 flex flex-col gap-1">
            <NavLinks />
          </div>
        )}
      </div>
    </nav>
  );
}
