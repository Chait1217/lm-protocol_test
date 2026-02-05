import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  injectedWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { base } from "wagmi/chains";

// projectId: get a free one at https://cloud.walletconnect.com/
// WalletConnect first so mobile users can connect to MetaMask via WalletConnect (no injection in mobile browser)
export const config = getDefaultConfig({
  appName: "LM Protocol",
  projectId: "7ec54a62f398c9a05d4132334a6acd1d",
  chains: [base],
  wallets: [
    {
      groupName: "Recommended",
      wallets: [walletConnectWallet, metaMaskWallet, injectedWallet],
    },
  ],
  ssr: false,
});
