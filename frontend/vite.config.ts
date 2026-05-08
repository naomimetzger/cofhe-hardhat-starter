import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    // Force pre-bundling of CommonJS tweetnacl for ESM default import interop in browser.
    include: ["tweetnacl", "tweetnacl/nacl-fast.js", "iframe-shared-storage"],
    // Keep tfhe out of pre-bundling so its sibling tfhe_bg.wasm URL resolves correctly.
    exclude: ["tfhe", "@cofhe/sdk", "@cofhe/sdk/web"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
