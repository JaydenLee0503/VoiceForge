import {
  buildDeterministicFeedbackSummary,
  buildDeterministicLiveMetricsSummary,
} from "../../../lib/voice-feedback/analysis";
import type {
  FeedbackResponse,
  FeedbackSummary,
  LiveMetricsResponse,
  LiveMetricsSummary,
  SessionAnalysisPayload,
} from "../../../lib/voice-feedback/contracts";

const LIVE_METRICS_ENDPOINT = "/api/groq/live-metrics";
const SESSION_FEEDBACK_ENDPOINT = "/api/groq/session-feedback";

async function postSessionJson<T>(
  endpoint: string,
  payload: SessionAnalysisPayload,
  signal?: AbortSignal,
) {
  const response = await fetch(endpoint, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });

  if (response.status === 404) {
    throw new Error("Feedback endpoint is unavailable.");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Feedback request failed.");
  }

  return (await response.json()) as T;
}

export async function requestSessionFeedback(
  payload: SessionAnalysisPayload,
): Promise<FeedbackSummary> {
  const fallback = buildDeterministicFeedbackSummary(payload);

  if (!payload.transcript.some((entry) => entry.role === "user")) {
    return fallback;
  }

  try {
    const response = await postSessionJson<FeedbackResponse>(
      SESSION_FEEDBACK_ENDPOINT,
      payload,
    );

    return response.feedback;
  } catch {
    return {
      ...fallback,
      source: "mock",
    };
  }
}

export async function requestLiveMetrics(
  payload: SessionAnalysisPayload,
  signal?: AbortSignal,
): Promise<LiveMetricsSummary> {
  const fallback = buildDeterministicLiveMetricsSummary(payload);

  if (!payload.transcript.some((entry) => entry.role === "user")) {
    return fallback;
  }

  try {
    const response = await postSessionJson<LiveMetricsResponse>(
      LIVE_METRICS_ENDPOINT,
      payload,
      signal,
    );

    return response.liveMetrics;
  } catch {
    return {
      ...fallback,
      source: "mock",
      updatedAt: Date.now(),
    };
  }
}
