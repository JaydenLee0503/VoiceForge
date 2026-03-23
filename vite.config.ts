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
  debateAgentId?: string;
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
  featherlessApiKey?: string;
  groqApiKey?: string;
  groqApiKeys?: string[];
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
        debateAgentId: env.ELEVENLABS_DEBATE_AGENT_ID,
      }),
      voiceForgeGroqApiPlugin({
        featherlessApiKey: env.FEATHERLESS_API_KEY,
        groqApiKey: env.GROQ_API_KEY,
        groqApiKeys: parseCsvEnv(env.GROQ_API_KEYS),
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@mediapipe/tasks-vision": path.resolve(
          __dirname,
          "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs",
        ),
      },
    },
  };
});
