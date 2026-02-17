import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { polygon } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo";

const polygonRpc =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon-rpc.com";

export const config = getDefaultConfig({
  appName: "LM Protocol Demo",
  projectId,
  chains: [polygon],
  transports: {
    [polygon.id]: http(polygonRpc),
  },
  ssr: true,
});

export { polygon };
