import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

// projectId: get a free one at https://cloud.walletconnect.com/
// Using default wallets config - RainbowKit automatically handles MetaMask mobile via WalletConnect
export const config = getDefaultConfig({
  appName: "LM Protocol",
  projectId: "7ec54a62f398c9a05d4132334a6acd1d",
  chains: [base],
  ssr: false,
});
