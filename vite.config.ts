import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { createElevenLabsSignedUrlMiddleware } from "./server/elevenlabs/signed-url";
import { createGroqFeedbackMiddleware } from "./server/groq/feedback";

function parseCsvEnv(value?: string) {
  return value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];
}

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

function voiceForgeGroqApiPlugin(config: {
  apiKey?: string;
  apiKeys?: string[];
}): Plugin {
  const middleware = createGroqFeedbackMiddleware(config);

  return {
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    name: "voiceforge-groq-api",
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
      voiceForgeGroqApiPlugin({
        apiKey: env.GROQ_API_KEY,
        apiKeys: parseCsvEnv(env.GROQ_API_KEYS),
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
