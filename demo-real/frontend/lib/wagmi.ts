import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, fallback, http } from "wagmi";
import { polygon } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const hasRealWalletConnectProjectId =
  rawProjectId.trim().length > 0 && rawProjectId.trim().toLowerCase() !== "demo";
const projectId = rawProjectId.trim();

const polygonRpc =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon-rpc.com";
const polygonFallbackRpcs = [
  polygonRpc,
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.llamarpc.com",
  "https://rpc.ankr.com/polygon",
];

export const config = hasRealWalletConnectProjectId
  ? getDefaultConfig({
      appName: "LM Protocol Demo",
      projectId,
      chains: [polygon],
      transports: {
        [polygon.id]: fallback(polygonFallbackRpcs.map((url) => http(url))),
      },
      ssr: true,
    })
  : createConfig({
      chains: [polygon],
      connectors: [injected({ shimDisconnect: true })],
      transports: {
        [polygon.id]: fallback(polygonFallbackRpcs.map((url) => http(url))),
      },
      ssr: true,
    });

export { polygon };
