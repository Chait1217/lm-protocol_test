"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-gray-400 mb-8">Page not found</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 font-medium"
          >
            Home
          </Link>
          <Link
            href="/trade-demo"
            className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 font-medium"
          >
            Trade Demo
          </Link>
          <Link
            href="/base-vault"
            className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 font-medium"
          >
            Polygon Vault
          </Link>
          <Link
            href="/transactions"
            className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 font-medium"
          >
            Transactions
          </Link>
        </div>
      </main>
    </div>
  );
}
