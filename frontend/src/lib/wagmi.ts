import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id";

export const wagmiConfig = getDefaultConfig({
  appName: "TimeCapsule",
  projectId,
  chains: [baseSepolia],
  ssr: false,
});
