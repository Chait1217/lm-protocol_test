import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base } from "wagmi/chains";

const projectId = "7ec54a62f398c9a05d4132334a6acd1d";

export const config = getDefaultConfig({
  appName: "LM Protocol",
  projectId,
  chains: [base],
  ssr: false,
  transports: {
    [base.id]: http(),
  },
});
