"use client";

import { useAccount, useBalance, useReadContract } from "wagmi";
import { getContractAddresses, MOCK_USDC_ABI, VAULT_ABI } from "@/lib/contracts";
import { formatUSDC } from "@/lib/utils";
import { Wallet, Coins, Landmark, CircleDollarSign } from "lucide-react";

const addresses = getContractAddresses();

// ETH price estimate for display (testnet = 0, but show for illustration)
const ETH_PRICE_USD = 2500; // rough ETH price; on testnet this is just for display

export default function WalletPortfolio() {
  const { address, isConnected } = useAccount();

  // Native balance (ETH / POL)
  const { data: nativeBalance } = useBalance({
    address,
  });

  // USDC balance
  const { data: usdcBalance } = useReadContract({
    address: addresses.mockUsdc,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // Vault shares value
  const { data: vaultShares } = useReadContract({
    address: addresses.vault,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const { data: vaultShareValue } = useReadContract({
    address: addresses.vault,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: vaultShares ? [vaultShares as bigint] : undefined,
  });

  if (!isConnected) return null;

  const ethAmount = nativeBalance ? parseFloat(nativeBalance.formatted) : 0;
  const ethValueUsd = ethAmount * ETH_PRICE_USD;
  const usdcAmount = usdcBalance ? Number(usdcBalance as bigint) / 1e6 : 0;
  const vaultValueUsd = vaultShareValue ? Number(vaultShareValue as bigint) / 1e6 : 0;
  const totalValueUsd = ethValueUsd + usdcAmount + vaultValueUsd;

  return (
    <div className="rounded-2xl border border-neon/20 bg-gradient-to-br from-gray-900/80 to-black p-5 neon-glow">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-neon" />
        <h3 className="text-white font-semibold text-sm">Portfolio Value</h3>
      </div>

      {/* Total Value */}
      <div className="mb-4">
        <div className="text-gray-400 text-xs mb-1">Total Wallet Value</div>
        <div className="text-3xl font-bold text-neon">
          ${totalValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2.5">
        {/* ETH */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <CircleDollarSign className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <div className="text-white text-sm font-medium">
                {nativeBalance?.symbol || "ETH"}
              </div>
              <div className="text-gray-500 text-xs">
                {ethAmount.toFixed(4)} {nativeBalance?.symbol || "ETH"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white text-sm font-medium">
              ${ethValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-gray-500 text-xs">@${ETH_PRICE_USD.toLocaleString()}</div>
          </div>
        </div>

        {/* USDC */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div>
              <div className="text-white text-sm font-medium">USDC</div>
              <div className="text-gray-500 text-xs">
                {usdcAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white text-sm font-medium">
              ${usdcAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-gray-500 text-xs">1:1 USD</div>
          </div>
        </div>

        {/* Vault Shares */}
        {vaultValueUsd > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Landmark className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">Vault (lmUSDC)</div>
                <div className="text-gray-500 text-xs">
                  {formatUSDC(vaultShares as bigint)} shares
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white text-sm font-medium">
                ${vaultValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-gray-500 text-xs">vault value</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
