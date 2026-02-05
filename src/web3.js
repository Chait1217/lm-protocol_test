import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  injectedWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { base } from "wagmi/chains";

// projectId: get a free one at https://cloud.walletconnect.com/
// Mobile: MetaMask uses WalletConnect protocol to open the app via deep link
const projectId = "7ec54a62f398c9a05d4132334a6acd1d";

export const config = getDefaultConfig({
  appName: "LM Protocol",
  projectId,
  chains: [base],
  wallets: [
    {
      groupName: "Recommended",
      wallets: [
        // MetaMask - handles mobile deep linking automatically via WalletConnect
        metaMaskWallet({ projectId }),
        // WalletConnect - universal mobile wallet connector
        walletConnectWallet({ projectId }),
        // Injected - for browser extensions
        injectedWallet(),
      ],
    },
  ],
  ssr: false,
});
