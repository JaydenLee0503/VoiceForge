import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildDeterministicFeedbackSummary,
  buildDeterministicLiveMetricsSummary,
  buildPromptSnapshot,
} from "../../lib/voice-feedback/analysis";
import type {
  FeedbackResponse,
  FeedbackSummary,
  LiveMetricsResponse,
  LiveMetricsSummary,
  SessionAnalysisPayload,
} from "../../lib/voice-feedback/contracts";
import { matchesRoute, readJsonBody, sendJson, type NextFunction } from "../http";
import {
  requestGroqJsonWithFallback,
} from "./client";

const LIVE_METRICS_PATH = "/api/groq/live-metrics";
const SESSION_FEEDBACK_PATH = "/api/groq/session-feedback";
const POST_SESSION_PRIMARY_MODEL = "llama-3.3-70b-versatile";
const POST_SESSION_SECONDARY_MODEL = "qwen/qwen3-32b";
const POST_SESSION_TERTIARY_MODEL = "llama-3.1-8b-instant";

type GroqServerConfig = {
  apiKey?: string;
  apiKeys?: string[];
};

type GroqFeedbackCopy = {
  bestMoment?: string;
  coachSummary?: string;
  improvementArea?: string;
  nextChallenge?: string;
};

type GroqLiveCopy = {
  clarityLabel?: string;
  coachCue?: string;
  confidenceLabel?: string;
  liveSignal?: string;
  paceLabel?: string;
  primaryAim?: string;
};

type GroqFeedbackAnalyst = {
  fields: ReadonlyArray<
    keyof Pick<
    FeedbackSummary,
    "bestMoment" | "coachSummary" | "improvementArea" | "nextChallenge"
    >
  >;
  keyOrderOffset: number;
  maxCompletionTokens: number;
  modelPreferences: readonly string[];
  systemPrompt: string;
};

const POST_SESSION_ANALYSTS: readonly GroqFeedbackAnalyst[] = [
  {
    fields: ["bestMoment", "coachSummary"],
    keyOrderOffset: 0,
    maxCompletionTokens: 180,
    modelPreferences: [
      POST_SESSION_PRIMARY_MODEL,
      POST_SESSION_SECONDARY_MODEL,
      POST_SESSION_TERTIARY_MODEL,
    ],
    systemPrompt:
      "You are VoiceForge's strengths analyst. Return JSON only with keys bestMoment and coachSummary. Highlight the user's strongest exact speaking moment and write one short supportive summary. Keep each value concise, supportive, and under 22 words. Use the transcript and deterministic scores. Do not mention numeric scores.",
  },
  {
    keyOrderOffset: 1,
    fields: ["improvementArea"],
    maxCompletionTokens: 150,
    modelPreferences: [
      POST_SESSION_SECONDARY_MODEL,
      POST_SESSION_PRIMARY_MODEL,
      POST_SESSION_TERTIARY_MODEL,
    ],
    systemPrompt:
      "You are VoiceForge's improvement analyst. Return JSON only with key improvementArea. Identify the clearest fix in one concise, supportive sentence under 24 words. Use the transcript and deterministic scores. Do not mention numeric scores.",
  },
  {
    fields: ["nextChallenge"],
    keyOrderOffset: 2,
    maxCompletionTokens: 150,
    modelPreferences: [
      POST_SESSION_PRIMARY_MODEL,
      POST_SESSION_SECONDARY_MODEL,
      POST_SESSION_TERTIARY_MODEL,
    ],
    systemPrompt:
      "You are VoiceForge's next-step analyst. Return JSON only with key nextChallenge. Suggest the next practice focus in one concise, supportive sentence under 24 words. Use the transcript and deterministic scores. Do not mention numeric scores.",
  },
] as const;

function normalizeCopy(text: string | undefined, fallback: string, maxLength: number) {
  const cleaned = text?.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return fallback;
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const trimmed = cleaned.slice(0, maxLength).trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  const compact =
    lastSpace > 20 ? trimmed.slice(0, lastSpace).trim() : trimmed;

  return /[.!?]$/.test(compact) ? compact : `${compact}.`;
}

function getConfiguredGroqApiKeys(config: GroqServerConfig) {
  const keys = [...(config.apiKeys ?? [])];

  if (config.apiKey) {
    keys.push(config.apiKey);
  }

  return Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));
}

function toMockFeedback(feedback: FeedbackSummary): FeedbackResponse {
  return {
    feedback: {
      ...feedback,
      source: "mock",
    },
    mode: "mock",
  };
}

function toMockLiveMetrics(liveMetrics: LiveMetricsSummary): LiveMetricsResponse {
  return {
    liveMetrics: {
      ...liveMetrics,
      source: "mock",
      updatedAt: Date.now(),
    },
    mode: "mock",
  };
}

async function enrichFeedbackWithGroq(
  apiKeys: string[],
  payload: SessionAnalysisPayload,
  fallback: FeedbackSummary,
): Promise<FeedbackSummary> {
  const snapshot = buildPromptSnapshot(payload);
  const analystResults = await Promise.allSettled(
    POST_SESSION_ANALYSTS.map(async (analyst) => {
      const response = await requestGroqJsonWithFallback<GroqFeedbackCopy>({
        apiKeys,
        keyOrderOffset: analyst.keyOrderOffset,
        maxCompletionTokens: analyst.maxCompletionTokens,
        messages: [
          {
            content: analyst.systemPrompt,
            role: "system",
          },
          {
            content: JSON.stringify(snapshot),
            role: "user",
          },
        ],
        modelPreferences: analyst.modelPreferences,
      });

      return {
        copy: analyst.fields.reduce<Partial<GroqFeedbackCopy>>((copy, field) => {
          copy[field] = response[field];
          return copy;
        }, {}),
        fields: analyst.fields,
        model: response.model,
      };
    }),
  );

  const successfulAnalysts = analystResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failedMessages = analystResults.flatMap((result) =>
    result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
      : [],
  );

  if (successfulAnalysts.length === 0) {
    throw new Error(failedMessages.join(" | ") || "Groq post-session swarm failed.");
  }

  const analystCopy = successfulAnalysts.reduce<Partial<GroqFeedbackCopy>>(
    (copy, analyst) => {
      return {
        ...copy,
        ...analyst.copy,
      };
    },
    {},
  );
  const modelSummary = Array.from(
    new Set(successfulAnalysts.map((analyst) => analyst.model)),
  ).join(" + ");

  if (failedMessages.length > 0) {
    console.warn("[voiceforge] Groq post-session analyst fallback:", failedMessages.join(" | "));
  }

  return {
    ...fallback,
    bestMoment: normalizeCopy(analystCopy.bestMoment, fallback.bestMoment, 150),
    coachSummary: normalizeCopy(
      analystCopy.coachSummary,
      fallback.coachSummary,
      160,
    ),
    improvementArea: normalizeCopy(
      analystCopy.improvementArea,
      fallback.improvementArea,
      170,
    ),
    model: modelSummary || null,
    nextChallenge: normalizeCopy(
      analystCopy.nextChallenge,
      fallback.nextChallenge,
      170,
    ),
    source: "groq",
  };
}

async function enrichLiveMetricsWithGroq(
  apiKey: string,
  payload: SessionAnalysisPayload,
  fallback: LiveMetricsSummary,
): Promise<LiveMetricsSummary> {
  const snapshot = buildPromptSnapshot(payload);
  const response = await requestGroqJsonWithFallback<GroqLiveCopy>({
    apiKeys: [apiKey],
    maxCompletionTokens: 180,
    messages: [
      {
        content:
          "You are VoiceForge's live speaking coach. Return JSON only with keys clarityLabel, confidenceLabel, paceLabel, liveSignal, primaryAim, coachCue. Keep labels short and supportive. Do not change or invent the numeric scores.",
        role: "system",
      },
      {
        content: JSON.stringify(snapshot),
        role: "user",
      },
    ],
  });

  return {
    ...fallback,
    coachCue: normalizeCopy(response.coachCue, fallback.coachCue, 120),
    metrics: fallback.metrics.map((metric) => {
      if (metric.label === "Clarity") {
        return {
          ...metric,
          status: normalizeCopy(response.clarityLabel, metric.status, 28),
        };
      }

      if (metric.label === "Confidence") {
        return {
          ...metric,
          status: normalizeCopy(response.confidenceLabel, metric.status, 28),
        };
      }

      return {
        ...metric,
        status: normalizeCopy(response.paceLabel, metric.status, 28),
      };
    }),
    model: response.model,
    signals: [
      {
        label: "Live signal",
        value: normalizeCopy(
          response.liveSignal,
          fallback.signals[0]?.value ?? "Stable",
          30,
        ),
      },
      {
        label: "Primary aim",
        value: normalizeCopy(
          response.primaryAim,
          fallback.signals[1]?.value ?? "Protect clarity",
          40,
        ),
      },
    ],
    source: "groq",
    updatedAt: Date.now(),
  };
}

async function handleSessionFeedbackRequest(
  config: GroqServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
) {
  let payload: SessionAnalysisPayload;

  try {
    payload = await readJsonBody<SessionAnalysisPayload>(req);
  } catch (error) {
    sendJson(res, 400, {
      message:
        error instanceof Error ? error.message : "Invalid feedback request body.",
      mode: "error",
    });
    return;
  }

  const fallback = buildDeterministicFeedbackSummary(payload);
  const configuredApiKeys = getConfiguredGroqApiKeys(config);

  if (configuredApiKeys.length === 0) {
    sendJson(res, 200, toMockFeedback(fallback));
    return;
  }

  try {
    const feedback = await enrichFeedbackWithGroq(
      configuredApiKeys,
      payload,
      fallback,
    );
    sendJson(res, 200, {
      feedback,
      mode: "groq",
    } satisfies FeedbackResponse);
  } catch (error) {
    console.warn("[voiceforge] Groq session feedback fallback:", error);
    sendJson(res, 200, toMockFeedback(fallback));
  }
}

async function handleLiveMetricsRequest(
  config: GroqServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
) {
  let payload: SessionAnalysisPayload;

  try {
    payload = await readJsonBody<SessionAnalysisPayload>(req);
  } catch (error) {
    sendJson(res, 400, {
      message:
        error instanceof Error ? error.message : "Invalid live metrics request body.",
      mode: "error",
    });
    return;
  }

  const fallback = buildDeterministicLiveMetricsSummary(payload);
  const liveMetricsApiKey = getConfiguredGroqApiKeys(config)[0];

  if (!liveMetricsApiKey) {
    sendJson(res, 200, toMockLiveMetrics(fallback));
    return;
  }

  try {
    const liveMetrics = await enrichLiveMetricsWithGroq(
      liveMetricsApiKey,
      payload,
      fallback,
    );
    sendJson(res, 200, {
      liveMetrics,
      mode: "groq",
    } satisfies LiveMetricsResponse);
  } catch (error) {
    console.warn("[voiceforge] Groq live metrics fallback:", error);
    sendJson(res, 200, toMockLiveMetrics(fallback));
  }
}

export function createGroqFeedbackMiddleware(config: GroqServerConfig) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFunction,
  ) => {
    if (matchesRoute(req, SESSION_FEEDBACK_PATH)) {
      if (req.method !== "POST") {
        sendJson(res, 405, {
          message: "Method not allowed.",
          mode: "error",
        });
        return;
      }

      await handleSessionFeedbackRequest(config, req, res);
      return;
    }

    if (matchesRoute(req, LIVE_METRICS_PATH)) {
      if (req.method !== "POST") {
        sendJson(res, 405, {
          message: "Method not allowed.",
          mode: "error",
        });
        return;
      }

      await handleLiveMetricsRequest(config, req, res);
      return;
    }

    next();
  };
}
