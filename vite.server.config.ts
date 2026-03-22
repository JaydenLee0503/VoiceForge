import path from "path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: false,
    minify: false,
    outDir: "dist-server",
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
    ssr: path.resolve(__dirname, "server/index.ts"),
    target: "node20",
  },
});
