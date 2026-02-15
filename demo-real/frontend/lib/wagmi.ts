import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, type Chain } from "wagmi";
import { polygon, polygonAmoy } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo";

// Local Anvil chain definition
const localhost: Chain = {
  id: 31337,
  name: "Localhost (Anvil)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  blockExplorers: {
    default: { name: "Local", url: "http://localhost:8545" },
  },
  testnet: true,
};

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");

const chainMap: Record<number, Chain> = {
  31337: localhost,
  80002: polygonAmoy,
  137: polygon,
};

const activeChain = chainMap[chainId] ?? localhost;

export const config = getDefaultConfig({
  appName: "LM Protocol Demo",
  projectId,
  chains: [activeChain],
  transports: {
    [localhost.id]: http("http://127.0.0.1:8545"),
    [polygonAmoy.id]: http("https://rpc-amoy.polygon.technology"),
    [polygon.id]: http("https://polygon-rpc.com"),
  },
  ssr: true,
});

export { activeChain };
