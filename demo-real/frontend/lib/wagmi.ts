import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, polygon } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo";

const baseRpc =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
const polygonRpc =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon-rpc.com";

export const config = getDefaultConfig({
  appName: "LM Protocol Demo",
  projectId,
  chains: [base, polygon],
  transports: {
    [base.id]: http(baseRpc),
    [polygon.id]: http(polygonRpc),
  },
  ssr: true,
});

export { base, polygon };
