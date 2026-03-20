import type { IncomingMessage, ServerResponse } from "node:http";

export type NextFunction = (error?: unknown) => void;

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function matchesRoute(req: IncomingMessage, routePath: string) {
  if (!req.url) {
    return false;
  }

  const requestUrl = new URL(req.url, "http://localhost");
  return requestUrl.pathname === routePath;
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  let rawBody = "";

  for await (const chunk of req) {
    rawBody += chunk;
  }

  if (!rawBody) {
    throw new Error("Request body is required.");
  }

  return JSON.parse(rawBody) as T;
}
