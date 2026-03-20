import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { createElevenLabsSignedUrlMiddleware } from "./server/elevenlabs/signed-url";

function voiceForgeElevenLabsApiPlugin(config: {
  agentId?: string;
  apiKey?: string;
}): Plugin {
  const middleware = createElevenLabsSignedUrlMiddleware(config);

  return {
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    name: "voiceforge-elevenlabs-api",
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      voiceForgeElevenLabsApiPlugin({
        agentId: env.ELEVENLABS_AGENT_ID,
        apiKey: env.ELEVENLABS_API_KEY,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
