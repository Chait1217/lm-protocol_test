import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";

const projectId = "7ec54a62f398c9a05d4132334a6acd1d";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, walletConnectWallet, injectedWallet],
    },
  ],
  {
    appName: "LM Protocol",
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [base],
  ssr: false,
  transports: {
    [base.id]: http(),
  },
});
