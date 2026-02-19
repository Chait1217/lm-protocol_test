import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { config } from "./web3";
import { base } from "wagmi/chains";

const queryClient = new QueryClient();

// StrictMode removed: it double-mounts in dev and causes MetaMask "Confirm connection" to loop
createRoot(document.getElementById("root")).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider
        theme={darkTheme()}
        modalSize="compact"
        coolMode
        showRecentTransactions={false}
        initialChain={base}
      >
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
