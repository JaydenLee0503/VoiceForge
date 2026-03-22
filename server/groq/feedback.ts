import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildDebatePromptSnapshot,
  buildDeterministicDebateResult,
} from "../../lib/debate/analysis";
import {
  buildDeterministicCustomPracticeQuestions,
} from "../../lib/practice/question-generation";
import type {
  CustomPracticeQuestionRequest,
  CustomPracticeQuestionResponse,
} from "../../lib/practice/contracts";
import {
  buildDeterministicFeedbackSummary,
  buildDeterministicLiveMetricsSummary,
  buildPromptSnapshot,
} from "../../lib/voice-feedback/analysis";
import type {
  DebateJudgeResponse,
  DebateJudgeSummary,
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
const CUSTOM_PRACTICE_QUESTIONS_PATH = "/api/groq/custom-practice-questions";
const DEBATE_JUDGE_PATH = "/api/groq/debate-judge";
const LIVE_METRICS_PRIMARY_MODEL = "llama-3.1-8b-instant";
const LIVE_METRICS_SECONDARY_MODEL = "qwen/qwen3-32b";
const LIVE_METRICS_TERTIARY_MODEL = "llama-3.3-70b-versatile";
const POST_SESSION_PRIMARY_MODEL = "llama-3.3-70b-versatile";
const POST_SESSION_SECONDARY_MODEL = "qwen/qwen3-32b";
const POST_SESSION_TERTIARY_MODEL = "llama-3.1-8b-instant";
const CUSTOM_PRACTICE_PRIMARY_MODEL = "openai/gpt-oss-120b";
const CUSTOM_PRACTICE_SECONDARY_MODEL = "llama-3.3-70b-versatile";
const CUSTOM_PRACTICE_TERTIARY_MODEL = "qwen/qwen3-32b";
const DEBATE_JUDGE_PRIMARY_MODEL = "llama-3.3-70b-versatile";
const DEBATE_JUDGE_SECONDARY_MODEL = "qwen/qwen3-32b";
const DEBATE_JUDGE_TERTIARY_MODEL = "openai/gpt-oss-120b";

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

type GroqPracticeQuestions = {
  intro?: string;
  questions?: string[];
};

type GroqDebateJudge = {
  finalVerdict?: string;
  rebuttalQuality?: string;
  strongestArgument?: string;
  suggestedImprovement?: string;
  weakestArgument?: string;
  winner?: string;
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
      "You are VoiceForge's strengths analyst. Return JSON only with keys bestMoment and coachSummary. Each value must be one complete supportive sentence, not a fragment, quote, or single word. bestMoment should explain what the user said well and why it landed. coachSummary should summarize the session in a calm, useful way. Keep each value between 8 and 20 words. Do not mention numeric scores or repeat coach lines.",
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
      "You are VoiceForge's improvement analyst. Return JSON only with key improvementArea. Write one complete supportive sentence that names the clearest fix. Keep it between 8 and 20 words. Do not mention numeric scores, use labels like 'Pace:', or return fragments.",
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
      "You are VoiceForge's next-step analyst. Return JSON only with key nextChallenge. Write one complete supportive sentence with the next practice challenge. Keep it between 8 and 20 words. Prefer an action-led suggestion. Do not mention numeric scores or return fragments.",
  },
] as const;

function cleanCopy(text: unknown) {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

function trimCopy(cleaned: string, maxLength: number) {
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const trimmed = cleaned.slice(0, maxLength).trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  const compact =
    lastSpace > 20 ? trimmed.slice(0, lastSpace).trim() : trimmed;

  return /[.!?]$/.test(compact) ? compact : `${compact}.`;
}

function normalizeCopy(text: unknown, fallback: string, maxLength: number) {
  const cleaned = cleanCopy(text);

  if (!cleaned) {
    return fallback;
  }

  return trimCopy(cleaned, maxLength);
}

function normalizeMeaningfulCopy(
  text: unknown,
  fallback: string,
  maxLength: number,
  minWords: number,
  minLength: number,
) {
  const cleaned = cleanCopy(text);

  if (!cleaned) {
    return fallback;
  }

  const unlabeled = cleaned.replace(/^[A-Z][A-Za-z ]{0,20}:\s*/, "");
  const normalized = trimCopy(unlabeled, maxLength);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (normalized.length < minLength || wordCount < minWords) {
    return fallback;
  }

  return normalized;
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

function toMockDebateJudge(judge: DebateJudgeSummary): DebateJudgeResponse {
  return {
    judge: {
      ...judge,
      source: "mock",
    },
    mode: "mock",
  };
}

function normalizeJudgeWinner(winner: unknown, fallback: DebateJudgeSummary["winner"]) {
  if (winner === "user" || winner === "opponent" || winner === "draw") {
    return winner;
  }

  return fallback;
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
    bestMoment: normalizeMeaningfulCopy(
      analystCopy.bestMoment,
      fallback.bestMoment,
      150,
      6,
      36,
    ),
    coachSummary: normalizeMeaningfulCopy(
      analystCopy.coachSummary,
      fallback.coachSummary,
      160,
      7,
      42,
    ),
    improvementArea: normalizeMeaningfulCopy(
      analystCopy.improvementArea,
      fallback.improvementArea,
      170,
      6,
      38,
    ),
    model: modelSummary || null,
    nextChallenge: normalizeMeaningfulCopy(
      analystCopy.nextChallenge,
      fallback.nextChallenge,
      170,
      6,
      38,
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
    modelPreferences: [
      LIVE_METRICS_PRIMARY_MODEL,
      LIVE_METRICS_SECONDARY_MODEL,
      LIVE_METRICS_TERTIARY_MODEL,
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

function normalizePracticeQuestions(
  candidateQuestions: unknown,
  fallbackQuestions: CustomPracticeQuestionResponse["questions"],
) {
  if (!Array.isArray(candidateQuestions)) {
    return fallbackQuestions;
  }

  const questions = candidateQuestions
    .map((question) => (typeof question === "string" ? question.trim() : ""))
    .filter((question) => question.length > 0)
    .slice(0, fallbackQuestions.length);

  if (questions.length !== fallbackQuestions.length) {
    return fallbackQuestions;
  }

  return questions.map((question, index) => ({
    id: fallbackQuestions[index]?.id ?? `cp-${index + 1}`,
    text: trimCopy(question, 180),
  }));
}

async function enrichCustomPracticeQuestionsWithGroq(
  apiKeys: string[],
  request: CustomPracticeQuestionRequest,
  fallback: CustomPracticeQuestionResponse,
): Promise<CustomPracticeQuestionResponse> {
  const response = await requestGroqJsonWithFallback<GroqPracticeQuestions>({
    apiKeys,
    maxCompletionTokens: 420,
    messages: [
      {
        content:
          "You design thoughtful speaking rehearsal prompts for VoiceForge. Return JSON only with keys intro and questions. intro must be one short sentence. questions must be an array of varied, creative, high-signal speaking prompts tailored to the user's topic, audience, goal, and intensity. Avoid repetition, trivia, and generic filler.",
        role: "system",
      },
      {
        content: JSON.stringify(request),
        role: "user",
      },
    ],
    modelPreferences: [
      CUSTOM_PRACTICE_PRIMARY_MODEL,
      CUSTOM_PRACTICE_SECONDARY_MODEL,
      CUSTOM_PRACTICE_TERTIARY_MODEL,
    ],
  });

  return {
    intro: normalizeCopy(response.intro, fallback.intro, 140),
    model: response.model,
    questions: normalizePracticeQuestions(response.questions, fallback.questions),
    source: "groq",
  };
}

async function enrichDebateJudgeWithGroq(
  apiKeys: string[],
  payload: SessionAnalysisPayload,
  fallback: DebateJudgeSummary,
): Promise<DebateJudgeSummary> {
  const snapshot = buildDebatePromptSnapshot(payload);

  if (!snapshot) {
    return fallback;
  }

  const response = await requestGroqJsonWithFallback<GroqDebateJudge>({
    apiKeys,
    maxCompletionTokens: 260,
    messages: [
      {
        content:
          "You are VoiceForge's debate judge. Return JSON only with keys winner, finalVerdict, strongestArgument, weakestArgument, rebuttalQuality, suggestedImprovement. winner must be one of user, opponent, draw. Keep each field concise, specific, and grounded in the transcript. Do not mention numeric scores.",
        role: "system",
      },
      {
        content: JSON.stringify(snapshot),
        role: "user",
      },
    ],
    modelPreferences: [
      DEBATE_JUDGE_PRIMARY_MODEL,
      DEBATE_JUDGE_SECONDARY_MODEL,
      DEBATE_JUDGE_TERTIARY_MODEL,
    ],
  });

  return {
    finalVerdict: normalizeMeaningfulCopy(
      response.finalVerdict,
      fallback.finalVerdict,
      180,
      7,
      44,
    ),
    model: response.model,
    rebuttalQuality: normalizeMeaningfulCopy(
      response.rebuttalQuality,
      fallback.rebuttalQuality,
      170,
      6,
      38,
    ),
    source: "groq",
    strongestArgument: normalizeMeaningfulCopy(
      response.strongestArgument,
      fallback.strongestArgument,
      170,
      5,
      30,
    ),
    suggestedImprovement: normalizeMeaningfulCopy(
      response.suggestedImprovement,
      fallback.suggestedImprovement,
      170,
      6,
      32,
    ),
    weakestArgument: normalizeMeaningfulCopy(
      response.weakestArgument,
      fallback.weakestArgument,
      170,
      5,
      30,
    ),
    winner: normalizeJudgeWinner(response.winner, fallback.winner),
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

async function handleCustomPracticeQuestionsRequest(
  config: GroqServerConfig,
  req: IncomingMessage,
  res: ServerResponse,
) {
  let payload: CustomPracticeQuestionRequest;

  try {
    payload = await readJsonBody<CustomPracticeQuestionRequest>(req);
  } catch (error) {
    sendJson(res, 400, {
      message:
        error instanceof Error ? error.message : "Invalid custom practice request body.",
      mode: "error",
    });
    return;
  }

  const fallback = buildDeterministicCustomPracticeQuestions(payload);
  const configuredApiKeys = getConfiguredGroqApiKeys(config);

  if (configuredApiKeys.length === 0) {
    sendJson(res, 200, fallback);
    return;
  }

  try {
    const questionSet = await enrichCustomPracticeQuestionsWithGroq(
      configuredApiKeys,
      payload,
      fallback,
    );
    sendJson(res, 200, questionSet);
  } catch (error) {
    console.warn("[voiceforge] Groq custom practice fallback:", error);
    sendJson(res, 200, fallback);
  }
}

async function handleDebateJudgeRequest(
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
        error instanceof Error ? error.message : "Invalid debate judge request body.",
      mode: "error",
    });
    return;
  }

  if (!payload.debateSettings) {
    sendJson(res, 400, {
      message: "Debate settings are required for judge requests.",
      mode: "error",
    });
    return;
  }

  const fallback = buildDeterministicDebateResult(payload).judgeSummary;
  const configuredApiKeys = getConfiguredGroqApiKeys(config);

  if (configuredApiKeys.length === 0) {
    sendJson(res, 200, toMockDebateJudge(fallback));
    return;
  }

  try {
    const judge = await enrichDebateJudgeWithGroq(configuredApiKeys, payload, fallback);
    sendJson(res, 200, {
      judge,
      mode: "groq",
    } satisfies DebateJudgeResponse);
  } catch (error) {
    console.warn("[voiceforge] Groq debate judge fallback:", error);
    sendJson(res, 200, toMockDebateJudge(fallback));
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

    if (matchesRoute(req, CUSTOM_PRACTICE_QUESTIONS_PATH)) {
      if (req.method !== "POST") {
        sendJson(res, 405, {
          message: "Method not allowed.",
          mode: "error",
        });
        return;
      }

      await handleCustomPracticeQuestionsRequest(config, req, res);
      return;
    }

    if (matchesRoute(req, DEBATE_JUDGE_PATH)) {
      if (req.method !== "POST") {
        sendJson(res, 405, {
          message: "Method not allowed.",
          mode: "error",
        });
        return;
      }

      await handleDebateJudgeRequest(config, req, res);
      return;
    }

    next();
  };
}
