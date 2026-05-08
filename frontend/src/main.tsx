import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DemoProvider } from "./demo/DemoContext";
import { wagmiConfig } from "./lib/wagmi";
import "./styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider
        theme={lightTheme({
          accentColor: "#C9A84C",
          accentColorForeground: "#2C1810",
          borderRadius: "large",
          fontStack: "system",
        })}
      >
        <BrowserRouter>
          <DemoProvider>
            <App />
          </DemoProvider>
        </BrowserRouter>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
