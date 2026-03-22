import type { IncomingMessage, ServerResponse } from "node:http";

export type NextFunction = (error?: unknown) => void;
export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => void | Promise<void>;

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

export async function runMiddlewares(
  req: IncomingMessage,
  res: ServerResponse,
  middlewares: readonly Middleware[],
  onComplete: () => Promise<void> | void,
) {
  let index = -1;

  async function dispatch(nextIndex: number, error?: unknown): Promise<void> {
    if (error) {
      throw error;
    }

    if (res.writableEnded) {
      return;
    }

    if (nextIndex <= index) {
      throw new Error("next() was called multiple times.");
    }

    index = nextIndex;
    const middleware = middlewares[nextIndex];

    if (!middleware) {
      await onComplete();
      return;
    }

    await middleware(req, res, (nextError) => dispatch(nextIndex + 1, nextError));
  }

  await dispatch(0);
}
