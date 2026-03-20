import type { IncomingMessage, ServerResponse } from "node:http";

const ELEVENLABS_SIGNED_URL_PATH = "/api/elevenlabs/signed-url";

type ElevenLabsServerConfig = {
  apiKey?: string;
  agentId?: string;
};

type NextFunction = (error?: unknown) => void;

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function matchesSignedUrlRoute(req: IncomingMessage) {
  if (!req.url) {
    return false;
  }

  const requestUrl = new URL(req.url, "http://localhost");
  return requestUrl.pathname === ELEVENLABS_SIGNED_URL_PATH;
}

async function requestSignedUrl({
  agentId,
  apiKey,
}: Required<ElevenLabsServerConfig>) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    {
      headers: {
        Accept: "application/json",
        "xi-api-key": apiKey,
      },
    },
  );

  if (!response.ok) {
    const responseBody = await response.text();
    const errorSuffix = responseBody ? `: ${responseBody}` : "";

    throw new Error(
      `ElevenLabs signed URL request failed with ${response.status}${errorSuffix}`,
    );
  }

  const body = (await response.json()) as { signed_url?: string };

  if (!body.signed_url) {
    throw new Error("ElevenLabs signed URL response did not include signed_url.");
  }

  return body.signed_url;
}

export function createElevenLabsSignedUrlMiddleware(
  config: ElevenLabsServerConfig,
) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFunction,
  ) => {
    if (!matchesSignedUrlRoute(req)) {
      next();
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, {
        message: "Method not allowed.",
        mode: "error",
      });
      return;
    }

    if (!config.apiKey || !config.agentId) {
      sendJson(res, 200, {
        mode: "mock",
        reason: "missing_credentials",
      });
      return;
    }

    try {
      const signedUrl = await requestSignedUrl({
        agentId: config.agentId,
        apiKey: config.apiKey,
      });

      sendJson(res, 200, {
        mode: "elevenlabs",
        signedUrl,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to retrieve an ElevenLabs signed URL.";

      sendJson(res, 502, {
        message,
        mode: "error",
      });
    }
  };
}
