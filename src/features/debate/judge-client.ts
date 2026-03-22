import { buildDeterministicDebateResult, mergeDebateJudgeSummary } from "../../../lib/debate/analysis";
import type {
  DebateJudgeResponse,
  DebateResult,
  SessionAnalysisPayload,
} from "../../../lib/voice-feedback/contracts";

const DEBATE_JUDGE_ENDPOINT = "/api/groq/debate-judge";

async function postDebateJudgeRequest(payload: SessionAnalysisPayload) {
  const response = await fetch(DEBATE_JUDGE_ENDPOINT, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (response.status === 404) {
    throw new Error("Debate judge endpoint is unavailable.");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Debate judge request failed.");
  }

  return (await response.json()) as DebateJudgeResponse;
}

export async function requestDebateJudgment(
  payload: SessionAnalysisPayload,
): Promise<DebateResult> {
  const fallback = buildDeterministicDebateResult(payload);

  if (!payload.debateSettings || !payload.transcript.some((entry) => entry.role === "user")) {
    return fallback;
  }

  try {
    const response = await postDebateJudgeRequest(payload);
    return mergeDebateJudgeSummary(fallback, response.judge);
  } catch {
    return {
      ...fallback,
      judgeSummary: {
        ...fallback.judgeSummary,
        source: "mock",
      },
      updatedAt: Date.now(),
    };
  }
}
