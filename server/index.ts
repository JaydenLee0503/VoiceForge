import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createElevenLabsSignedUrlMiddleware } from "./elevenlabs/signed-url";
import {
  runMiddlewares,
  sendJson,
  type Middleware,
} from "./http";
import { createGroqFeedbackMiddleware } from "./groq/feedback";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 4173;
const API_NOT_FOUND_MESSAGE = "API route not found.";
const CLIENT_BUILD_MISSING_MESSAGE =
  "Client build output is missing. Run `npm run build` before `npm run serve`.";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_ROOT = path.resolve(__dirname, "../dist");

function parseCsvEnv(value?: string) {
  return value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];
}

async function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");

  try {
    const raw = await readFile(envPath, "utf8");

    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    const missingFile =
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT";

    if (!missingFile) {
      throw error;
    }
  }
}

function getContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

async function resolveStaticFilePath(requestPath: string) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const candidatePath = path.resolve(CLIENT_DIST_ROOT, `.${normalizedPath}`);

  if (!candidatePath.startsWith(CLIENT_DIST_ROOT)) {
    return null;
  }

  try {
    const candidateStats = await stat(candidatePath);

    if (candidateStats.isFile()) {
      return candidatePath;
    }
  } catch {}

  if (path.extname(normalizedPath)) {
    return null;
  }

  const spaFallbackPath = path.resolve(CLIENT_DIST_ROOT, "index.html");

  if (!spaFallbackPath.startsWith(CLIENT_DIST_ROOT)) {
    return null;
  }

  try {
    const fallbackStats = await stat(spaFallbackPath);
    return fallbackStats.isFile() ? spaFallbackPath : null;
  } catch {
    return null;
  }
}

async function serveStaticAsset(
  urlPath: string,
  reqMethod: string,
  res: Parameters<Middleware>[1],
) {
  const filePath = await resolveStaticFilePath(urlPath);

  if (!filePath) {
    if (urlPath.startsWith("/api/")) {
      sendJson(res, 404, {
        message: API_NOT_FOUND_MESSAGE,
        mode: "error",
      });
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found.");
    return;
  }

  const fileContents = await readFile(filePath);
  const isHtml = path.extname(filePath).toLowerCase() === ".html";

  res.statusCode = 200;
  res.setHeader(
    "Cache-Control",
    isHtml ? "no-store" : "public, max-age=31536000, immutable",
  );
  res.setHeader("Content-Type", getContentType(filePath));
  res.setHeader("Content-Length", String(fileContents.byteLength));

  if (reqMethod === "HEAD") {
    res.end();
    return;
  }

  res.end(fileContents);
}

async function startVoiceForgeServer() {
  await loadDotEnvFile();

  const middlewares: Middleware[] = [
    createElevenLabsSignedUrlMiddleware({
      agentId: process.env.ELEVENLABS_AGENT_ID,
      apiKey: process.env.ELEVENLABS_API_KEY,
      debateAgentId: process.env.ELEVENLABS_DEBATE_AGENT_ID,
    }),
    createGroqFeedbackMiddleware({
      featherlessApiKey: process.env.FEATHERLESS_API_KEY,
      groqApiKey: process.env.GROQ_API_KEY,
      groqApiKeys: parseCsvEnv(process.env.GROQ_API_KEYS),
    }),
  ];

  const server = createServer(async (req, res) => {
    try {
      if (!req.url) {
        sendJson(res, 400, {
          message: "Request URL is required.",
          mode: "error",
        });
        return;
      }

      await runMiddlewares(req, res, middlewares, async () => {
        const requestUrl = new URL(req.url ?? "/", "http://localhost");

        if (req.method !== "GET" && req.method !== "HEAD") {
          if (requestUrl.pathname.startsWith("/api/")) {
            sendJson(res, 404, {
              message: API_NOT_FOUND_MESSAGE,
              mode: "error",
            });
            return;
          }

          res.statusCode = 405;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("Method not allowed.");
          return;
        }

        await serveStaticAsset(requestUrl.pathname, req.method, res);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error.";

      if (req.url?.startsWith("/api/")) {
        sendJson(res, 500, {
          message,
          mode: "error",
        });
        return;
      }

      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(message);
    }
  });

  const host = process.env.HOST || DEFAULT_HOST;
  const port = Number.parseInt(process.env.PORT || "", 10) || DEFAULT_PORT;

  server.listen(port, host, () => {
    console.log(`[voiceforge] Serving app and API on http://${host}:${port}`);
    console.log(`[voiceforge] Client assets: ${CLIENT_DIST_ROOT}`);
  });

  server.on("error", (error) => {
    console.error("[voiceforge] Server failed to start:", error);
    process.exitCode = 1;
  });
}

void (async () => {
  try {
    const stats = await stat(CLIENT_DIST_ROOT).catch(() => null);

    if (!stats?.isDirectory()) {
      throw new Error(CLIENT_BUILD_MISSING_MESSAGE);
    }

    await startVoiceForgeServer();
  } catch (error) {
    console.error(
      "[voiceforge] Unable to start runtime:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  }
})();
