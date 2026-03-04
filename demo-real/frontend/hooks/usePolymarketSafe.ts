// hooks/usePolymarketSafe.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { polygon } from "wagmi/chains";
import { getCreate2Address, keccak256, encodeAbiParameters } from "viem";

const RELAYER_URL = "https://relayer-v2.polymarket.com";
const POLYGON_SAFE_FACTORY = "0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b" as const;
const SAFE_INIT_CODE_HASH = "0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf" as const;

function deriveSafeAddress(owner: string): string {
  const salt = keccak256(
    encodeAbiParameters(
      [{ name: "address", type: "address" }],
      [owner as `0x${string}`]
    )
  );
  return getCreate2Address({
    bytecodeHash: SAFE_INIT_CODE_HASH,
    from: POLYGON_SAFE_FACTORY as `0x${string}`,
    salt,
  });
}

export function usePolymarketSafe() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: polygon.id });
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBuilderCreds = !!(
    process.env.NEXT_PUBLIC_POLYMARKET_BUILDER_API_KEY &&
    process.env.POLYMARKET_BUILDER_SECRET &&
    process.env.POLYMARKET_BUILDER_PASSPHRASE
  );

  const resolveSafe = useCallback(async () => {
    if (!address || !walletClient || !hasBuilderCreds) {
      setSafeAddress(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { RelayClient } = await import("@polymarket/builder-relayer-client");
      const { BuilderConfig } = await import("@polymarket/builder-signing-sdk");
      const key = process.env.NEXT_PUBLIC_POLYMARKET_BUILDER_API_KEY!;
      const secret = process.env.POLYMARKET_BUILDER_SECRET!;
      const passphrase = process.env.POLYMARKET_BUILDER_PASSPHRASE!;
      const builderConfig = new BuilderConfig({
        localBuilderCreds: { key, secret, passphrase },
      });
      const client = new RelayClient(
        RELAYER_URL,
        137,
        walletClient,
        builderConfig
      );
      const expectedSafe = deriveSafeAddress(address);
      const deployed = await client.getDeployed(expectedSafe);
      if (deployed) {
        setSafeAddress(expectedSafe);
        setIsDeployed(true);
      } else {
        try {
          const resp = await client.deploy();
          const txId = (resp as { transactionID?: string })?.transactionID;
          if (txId) {
            const final = await client.pollUntilState(
              txId,
              ["STATE_MINED", "STATE_CONFIRMED", "Complete", "Executed"],
              "STATE_FAILED",
              30,
              2000
            );
            if (final) {
              const txns = await client.getTransaction(txId);
              const proxyAddr = txns?.[0]?.proxyAddress ?? expectedSafe;
              setSafeAddress(proxyAddr);
              setIsDeployed(true);
            }
          }
        } catch (deployErr: unknown) {
          const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
          if (msg.includes("already deployed") || msg.includes("SAFE_DEPLOYED")) {
            setSafeAddress(expectedSafe);
            setIsDeployed(true);
          } else {
            setError(msg);
            setSafeAddress(null);
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to resolve Safe");
      setSafeAddress(null);
      setIsDeployed(false);
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, hasBuilderCreds]);

  useEffect(() => {
    if (!hasBuilderCreds) {
      setSafeAddress(null);
      setIsDeployed(false);
      setError(null);
      return;
    }
    resolveSafe();
  }, [hasBuilderCreds, resolveSafe]);

  return {
    safeAddress,
    isDeployed,
    isLoading,
    error,
    isProxyMode: hasBuilderCreds && !!safeAddress,
    funderAddress: safeAddress || address || undefined,
    signatureType: safeAddress ? 2 : 0,
  };
}
