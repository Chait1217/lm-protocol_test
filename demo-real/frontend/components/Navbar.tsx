"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Trade Demo", href: "/trade-demo" },
  { label: "Base Vault", href: "/base-vault" },
  { label: "Margin Trade", href: "/margin-trade" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-emerald-900/30 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-10 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-emerald-500/20 flex items-center justify-center shadow-glow">
              <span className="text-emerald-400 font-bold text-[10px]">LM</span>
            </div>
            <span className="hidden sm:block text-white font-semibold text-sm">
              Protocol
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
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
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </div>
    </nav>
  );
}
