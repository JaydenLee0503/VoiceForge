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
  FeedbackScores,
  FeedbackSummary,
  LiveMetricsResponse,
  LiveMetricsSummary,
  SessionAnalysisPayload,
} from "../../lib/voice-feedback/contracts";
import { matchesRoute, readJsonBody, sendJson, type NextFunction } from "../http";
import {
  FEATHERLESS_FALLBACK_MODELS,
  FEATHERLESS_PRIMARY_MODEL,
  type LlmProviderId,
  requestProviderJsonWithFallback,
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
const FEATHERLESS_POST_SESSION_PRIMARY_MODEL = FEATHERLESS_PRIMARY_MODEL;
const FEATHERLESS_POST_SESSION_SECONDARY_MODEL = FEATHERLESS_FALLBACK_MODELS[0];
const CUSTOM_PRACTICE_PRIMARY_MODEL = "openai/gpt-oss-120b";
const CUSTOM_PRACTICE_SECONDARY_MODEL = "llama-3.3-70b-versatile";
const CUSTOM_PRACTICE_TERTIARY_MODEL = "qwen/qwen3-32b";
const FEATHERLESS_DEBATE_JUDGE_PRIMARY_MODEL = "deepseek-ai/DeepSeek-V3.2";
const FEATHERLESS_DEBATE_JUDGE_SECONDARY_MODEL = "deepseek-ai/DeepSeek-V3.2-Speciale";
const DEBATE_JUDGE_PRIMARY_MODEL = "llama-3.3-70b-versatile";
const DEBATE_JUDGE_SECONDARY_MODEL = "qwen/qwen3-32b";
const DEBATE_JUDGE_TERTIARY_MODEL = "openai/gpt-oss-120b";

type AnalysisServerConfig = {
  featherlessApiKey?: string;
  groqApiKey?: string;
  groqApiKeys?: string[];
};

type GroqFeedbackCopy = {
  bestMoment?: string;
  coachSummary?: string;
  improvementArea?: string;
  nextChallenge?: string;
};

type GroqFeedbackScores = {
  clarity?: number;
  confidence?: number;
  eyeContactPresence?: number;
  fillerWords?: number;
  pace?: number;
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

type PostSessionProviderAttempt = {
  keyOrderOffset?: number;
  modelPreferences: readonly string[];
  provider: LlmProviderId;
};

type LlmProviderAttempt = {
  keyOrderOffset?: number;
  modelPreferences: readonly string[];
  provider: LlmProviderId;
};

type ScoreAnalystResult = {
  model: string;
  provider: LlmProviderId;
  scores: FeedbackScores;
};

type DebateJudgeAnalystResult = {
  finalVerdict: string;
  model: string;
  provider: LlmProviderId;
  rebuttalQuality: string;
  strongestArgument: string;
  suggestedImprovement: string;
  weakestArgument: string;
  winner: DebateJudgeSummary["winner"];
};

type PostSessionFeedbackAnalyst = {
  fields: ReadonlyArray<
    keyof Pick<
    FeedbackSummary,
    "bestMoment" | "coachSummary" | "improvementArea" | "nextChallenge"
    >
  >;
  maxCompletionTokens: number;
  providerAttempts: readonly PostSessionProviderAttempt[];
  systemPrompt: string;
};

const POST_SESSION_ANALYSTS: readonly PostSessionFeedbackAnalyst[] = [
  {
    fields: ["bestMoment", "coachSummary"],
    maxCompletionTokens: 240,
    providerAttempts: [
      {
        keyOrderOffset: 0,
        modelPreferences: [
          POST_SESSION_PRIMARY_MODEL,
          POST_SESSION_SECONDARY_MODEL,
          POST_SESSION_TERTIARY_MODEL,
        ],
        provider: "groq",
      },
    ],
    systemPrompt:
      "You are VoiceForge's strengths analyst. Return JSON only with keys bestMoment and coachSummary. bestMoment should be 2 sentences that name a concrete strong stretch from the user's performance, explain why it worked, and stay practical rather than vague praise. coachSummary should be 1 or 2 calm, useful sentences that summarize the session at a high level. Keep each value between 18 and 40 words. Do not mention numeric scores, labels, or repeat coach lines.",
  },
  {
    fields: ["improvementArea"],
    maxCompletionTokens: 220,
    providerAttempts: [
      {
        keyOrderOffset: 1,
        modelPreferences: [
          POST_SESSION_SECONDARY_MODEL,
          POST_SESSION_PRIMARY_MODEL,
          POST_SESSION_TERTIARY_MODEL,
        ],
        provider: "groq",
      },
    ],
    systemPrompt:
      "You are VoiceForge's improvement analyst. Return JSON only with key improvementArea. Write 2 sentences that identify the weakest part of the user's delivery, explain why it weakened the answer, and give one concrete correction. Keep it between 18 and 42 words. Do not mention numeric scores, use labels like 'Pace:', or return fragments.",
  },
  {
    fields: ["nextChallenge"],
    maxCompletionTokens: 150,
    providerAttempts: [
      {
        modelPreferences: [
          FEATHERLESS_POST_SESSION_PRIMARY_MODEL,
          FEATHERLESS_POST_SESSION_SECONDARY_MODEL,
        ],
        provider: "featherless",
      },
      {
        keyOrderOffset: 2,
        modelPreferences: [
          POST_SESSION_PRIMARY_MODEL,
          POST_SESSION_SECONDARY_MODEL,
          POST_SESSION_TERTIARY_MODEL,
        ],
        provider: "groq",
      },
    ],
    systemPrompt:
      "You are VoiceForge's next-step analyst. Return JSON only with key nextChallenge. Write one complete supportive sentence with the next practice challenge. Keep it between 8 and 20 words. Prefer an action-led suggestion. Do not mention numeric scores or return fragments.",
  },
] as const;

const POST_SESSION_SCORE_ANALYST_ATTEMPTS: readonly LlmProviderAttempt[] = [
  {
    keyOrderOffset: 0,
    modelPreferences: [
      POST_SESSION_PRIMARY_MODEL,
      POST_SESSION_SECONDARY_MODEL,
      POST_SESSION_TERTIARY_MODEL,
    ],
    provider: "groq",
  },
  {
    modelPreferences: [
      FEATHERLESS_POST_SESSION_PRIMARY_MODEL,
      FEATHERLESS_POST_SESSION_SECONDARY_MODEL,
    ],
    provider: "featherless",
  },
] as const;

const POST_SESSION_SCORE_BLEND_WEIGHT = 0.3;

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

function normalizeFeedbackScore(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(Math.min(98, Math.max(40, value)));
}

function blendFeedbackScores(
  deterministic: FeedbackScores,
  llmScores: FeedbackScores,
): FeedbackScores {
  const blend = (deterministicScore: number, llmScore: number) => {
    const weighted =
      deterministicScore * (1 - POST_SESSION_SCORE_BLEND_WEIGHT) +
      llmScore * POST_SESSION_SCORE_BLEND_WEIGHT;

    // Let the LLM act as a stricter reviewer without inflating baseline scores.
    return Math.round(Math.min(deterministicScore, weighted));
  };

  return {
    clarity: blend(deterministic.clarity, llmScores.clarity),
    confidence: blend(deterministic.confidence, llmScores.confidence),
    eyeContactPresence: blend(
      deterministic.eyeContactPresence,
      llmScores.eyeContactPresence,
    ),
    fillerWords: blend(deterministic.fillerWords, llmScores.fillerWords),
    pace: blend(deterministic.pace, llmScores.pace),
  };
}

type AnalysisProviderKeys = Record<LlmProviderId, string[]>;

function getConfiguredGroqApiKeys(config: AnalysisServerConfig) {
  const keys = [...(config.groqApiKeys ?? [])];

  if (config.groqApiKey) {
    keys.push(config.groqApiKey);
  }

  return Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));
}

function getConfiguredFeatherlessApiKeys(config: AnalysisServerConfig) {
  if (!config.featherlessApiKey?.trim()) {
    return [];
  }

  return [config.featherlessApiKey.trim()];
}

function getConfiguredProviderKeys(config: AnalysisServerConfig): AnalysisProviderKeys {
  return {
    featherless: getConfiguredFeatherlessApiKeys(config),
    groq: getConfiguredGroqApiKeys(config),
  };
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

function formatProviderModel(provider: LlmProviderId, model: string) {
  return `${provider}:${model}`;
}

function getPostSessionSource(
  providers: LlmProviderId[],
): FeedbackSummary["source"] {
  if (providers.length === 0) {
    return "mock";
  }

  if (providers.length === 1) {
    return providers[0];
  }

  return "llm";
}

function getSingleProviderSource(provider: LlmProviderId): DebateJudgeSummary["source"] {
  return provider;
}

function pickDebateJudgeWinner(
  results: readonly DebateJudgeAnalystResult[],
  fallbackWinner: DebateJudgeSummary["winner"],
) {
  if (results.length === 0) {
    return fallbackWinner;
  }

  const counts = new Map<DebateJudgeSummary["winner"], number>();

  for (const result of results) {
    counts.set(result.winner, (counts.get(result.winner) ?? 0) + 1);
  }

  const rankedWinners = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const topWinner = rankedWinners[0]?.[0] ?? fallbackWinner;
  const topCount = rankedWinners[0]?.[1] ?? 0;
  const nextCount = rankedWinners[1]?.[1] ?? 0;

  if (topCount > nextCount) {
    return topWinner;
  }

  if (results.some((result) => result.winner === fallbackWinner)) {
    return fallbackWinner;
  }

  return results[0]?.winner ?? fallbackWinner;
}

function scoreDebateJudgeCopy(candidate: string, fallback: string) {
  const normalizedCandidate = candidate.trim().toLowerCase();
  const normalizedFallback = fallback.trim().toLowerCase();
  const wordCount = candidate.split(/\s+/).filter(Boolean).length;
  const sentenceCount = candidate.split(/[.!?]+/).filter(Boolean).length;
  const noveltyPenalty = normalizedCandidate === normalizedFallback ? 50 : 0;

  return wordCount + sentenceCount * 8 - noveltyPenalty;
}

function pickDebateJudgeCopy(
  candidates: readonly string[],
  fallback: string,
) {
  if (candidates.length === 0) {
    return fallback;
  }

  return [...candidates].sort(
    (left, right) =>
      scoreDebateJudgeCopy(right, fallback) - scoreDebateJudgeCopy(left, fallback),
  )[0] ?? fallback;
}

async function runDebateJudgeAnalyst(
  attempt: LlmProviderAttempt,
  providerKeys: AnalysisProviderKeys,
  snapshot: NonNullable<ReturnType<typeof buildDebatePromptSnapshot>>,
  fallback: DebateJudgeSummary,
) {
  const apiKeys = providerKeys[attempt.provider];

  if (apiKeys.length === 0) {
    throw new Error(`No ${attempt.provider} API key configured.`);
  }

  const response = await requestProviderJsonWithFallback<GroqDebateJudge>({
    apiKeys,
    keyOrderOffset: attempt.keyOrderOffset,
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
    modelPreferences: attempt.modelPreferences,
    provider: attempt.provider,
  });

  return {
    finalVerdict: normalizeMeaningfulCopy(
      response.finalVerdict,
      fallback.finalVerdict,
      180,
      7,
      44,
    ),
    model: formatProviderModel(response.provider, response.model),
    provider: response.provider,
    rebuttalQuality: normalizeMeaningfulCopy(
      response.rebuttalQuality,
      fallback.rebuttalQuality,
      170,
      6,
      38,
    ),
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
  } satisfies DebateJudgeAnalystResult;
}

async function runPostSessionAnalyst(
  analyst: PostSessionFeedbackAnalyst,
  providerKeys: AnalysisProviderKeys,
  snapshot: ReturnType<typeof buildPromptSnapshot>,
) {
  const errors: string[] = [];

  for (const attempt of analyst.providerAttempts) {
    const apiKeys = providerKeys[attempt.provider];

    if (apiKeys.length === 0) {
      errors.push(`No ${attempt.provider} API key configured.`);
      continue;
    }

    try {
      const response = await requestProviderJsonWithFallback<GroqFeedbackCopy>({
        apiKeys,
        keyOrderOffset: attempt.keyOrderOffset,
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
        modelPreferences: attempt.modelPreferences,
        provider: attempt.provider,
      });

      return {
        copy: analyst.fields.reduce<Partial<GroqFeedbackCopy>>((copy, field) => {
          copy[field] = response[field];
          return copy;
        }, {}),
        fields: analyst.fields,
        model: formatProviderModel(response.provider, response.model),
        provider: response.provider,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Unknown ${attempt.provider} analyst error.`;

      errors.push(message);
    }
  }

  throw new Error(errors.join(" | ") || "Post-session analyst failed.");
}

async function runPostSessionScoreAnalyst(
  providerKeys: AnalysisProviderKeys,
  snapshot: ReturnType<typeof buildPromptSnapshot>,
  fallbackScores: FeedbackScores,
) {
  const errors: string[] = [];
  const { scores: _deterministicScores, ...scoreSnapshot } = snapshot;

  for (const attempt of POST_SESSION_SCORE_ANALYST_ATTEMPTS) {
    const apiKeys = providerKeys[attempt.provider];

    if (apiKeys.length === 0) {
      errors.push(`No ${attempt.provider} API key configured for score analyst.`);
      continue;
    }

    try {
      const response = await requestProviderJsonWithFallback<GroqFeedbackScores>({
        apiKeys,
        keyOrderOffset: attempt.keyOrderOffset,
        maxCompletionTokens: 220,
        messages: [
          {
            content:
              "You are VoiceForge's strict scoring analyst. Return JSON only with numeric keys clarity, confidence, pace, eyeContactPresence, and fillerWords. Score on a strict 40 to 98 scale. Use the transcript, highlights, pace, filler, hedge, and presence signals to calibrate. Average work should land in the 60s or low 70s, strong work in the high 70s or 80s, and only unusually sharp work should break 90. Do not mirror baseline scores upward out of politeness.",
            role: "system",
          },
          {
            content: JSON.stringify(scoreSnapshot),
            role: "user",
          },
        ],
        modelPreferences: attempt.modelPreferences,
        provider: attempt.provider,
        temperature: 0.1,
      });

      return {
        model: formatProviderModel(response.provider, response.model),
        provider: response.provider,
        scores: {
          clarity: normalizeFeedbackScore(response.clarity, fallbackScores.clarity),
          confidence: normalizeFeedbackScore(response.confidence, fallbackScores.confidence),
          eyeContactPresence: normalizeFeedbackScore(
            response.eyeContactPresence,
            fallbackScores.eyeContactPresence,
          ),
          fillerWords: normalizeFeedbackScore(
            response.fillerWords,
            fallbackScores.fillerWords,
          ),
          pace: normalizeFeedbackScore(response.pace, fallbackScores.pace),
        },
      } satisfies ScoreAnalystResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Unknown ${attempt.provider} score analyst error.`;

      errors.push(message);
    }
  }

  throw new Error(errors.join(" | ") || "Post-session score analyst failed.");
}

async function enrichFeedbackWithLlm(
  providerKeys: AnalysisProviderKeys,
  payload: SessionAnalysisPayload,
  fallback: FeedbackSummary,
): Promise<FeedbackSummary> {
  const snapshot = buildPromptSnapshot(payload);
  const [analystResults, scoreAnalystResult] = await Promise.all([
    Promise.allSettled(
      POST_SESSION_ANALYSTS.map((analyst) =>
        runPostSessionAnalyst(analyst, providerKeys, snapshot),
      ),
    ),
    runPostSessionScoreAnalyst(providerKeys, snapshot, fallback.scores)
      .then((result) => result)
      .catch((error) => error as Error),
  ]);

  const successfulAnalysts = analystResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failedMessages = analystResults.flatMap((result) =>
    result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
      : [],
  );
  const successfulScoreAnalyst =
    scoreAnalystResult instanceof Error ? null : scoreAnalystResult;

  if (scoreAnalystResult instanceof Error) {
    failedMessages.push(scoreAnalystResult.message);
  }

  if (successfulAnalysts.length === 0 && !successfulScoreAnalyst) {
    throw new Error(failedMessages.join(" | ") || "Post-session swarm failed.");
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
    new Set([
      ...successfulAnalysts.map((analyst) => analyst.model),
      ...(successfulScoreAnalyst ? [successfulScoreAnalyst.model] : []),
    ]),
  ).join(" + ");
  const providerSummary = Array.from(
    new Set([
      ...successfulAnalysts.map((analyst) => analyst.provider),
      ...(successfulScoreAnalyst ? [successfulScoreAnalyst.provider] : []),
    ]),
  );

  if (failedMessages.length > 0) {
    console.warn("[voiceforge] Post-session analyst fallback:", failedMessages.join(" | "));
  }

  return {
    ...fallback,
    bestMoment: normalizeMeaningfulCopy(
      analystCopy.bestMoment,
      fallback.bestMoment,
      260,
      14,
      80,
    ),
    coachSummary: normalizeMeaningfulCopy(
      analystCopy.coachSummary,
      fallback.coachSummary,
      190,
      12,
      60,
    ),
    improvementArea: normalizeMeaningfulCopy(
      analystCopy.improvementArea,
      fallback.improvementArea,
      280,
      14,
      90,
    ),
    model: modelSummary || null,
    nextChallenge: normalizeMeaningfulCopy(
      analystCopy.nextChallenge,
      fallback.nextChallenge,
      170,
      6,
      38,
    ),
    scores: successfulScoreAnalyst
      ? blendFeedbackScores(fallback.scores, successfulScoreAnalyst.scores)
      : fallback.scores,
    source: getPostSessionSource(providerSummary),
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

async function enrichDebateJudgeWithLlm(
  providerKeys: AnalysisProviderKeys,
  payload: SessionAnalysisPayload,
  fallback: DebateJudgeSummary,
): Promise<DebateJudgeSummary> {
  const snapshot = buildDebatePromptSnapshot(payload);

  if (!snapshot) {
    return fallback;
  }

  const providerAttempts: readonly LlmProviderAttempt[] = [
    {
      modelPreferences: [
        FEATHERLESS_DEBATE_JUDGE_PRIMARY_MODEL,
        FEATHERLESS_DEBATE_JUDGE_SECONDARY_MODEL,
      ],
      provider: "featherless",
    },
    {
      modelPreferences: [
        DEBATE_JUDGE_PRIMARY_MODEL,
        DEBATE_JUDGE_SECONDARY_MODEL,
        DEBATE_JUDGE_TERTIARY_MODEL,
      ],
      provider: "groq",
    },
  ];

  const analystResults = await Promise.allSettled(
    providerAttempts.map((attempt) =>
      runDebateJudgeAnalyst(attempt, providerKeys, snapshot, fallback),
    ),
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
    throw new Error(failedMessages.join(" | ") || "Debate judge failed.");
  }

  if (failedMessages.length > 0) {
    console.warn("[voiceforge] Debate judge partial fallback:", failedMessages.join(" | "));
  }

  const winner = pickDebateJudgeWinner(successfulAnalysts, fallback.winner);
  const alignedAnalysts = successfulAnalysts.filter((result) => result.winner === winner);
  const preferredAnalysts =
    alignedAnalysts.length > 0 ? alignedAnalysts : successfulAnalysts;
  const providerSummary = Array.from(
    new Set(successfulAnalysts.map((result) => result.provider)),
  );
  const modelSummary = Array.from(
    new Set(successfulAnalysts.map((result) => result.model)),
  ).join(" + ");

  return {
    finalVerdict: pickDebateJudgeCopy(
      preferredAnalysts.map((result) => result.finalVerdict),
      fallback.finalVerdict,
    ),
    model: modelSummary || null,
    rebuttalQuality: pickDebateJudgeCopy(
      preferredAnalysts.map((result) => result.rebuttalQuality),
      fallback.rebuttalQuality,
    ),
    source:
      providerSummary.length === 1
        ? getSingleProviderSource(providerSummary[0]!)
        : "llm",
    strongestArgument: pickDebateJudgeCopy(
      preferredAnalysts.map((result) => result.strongestArgument),
      fallback.strongestArgument,
    ),
    suggestedImprovement: pickDebateJudgeCopy(
      preferredAnalysts.map((result) => result.suggestedImprovement),
      fallback.suggestedImprovement,
    ),
    weakestArgument: pickDebateJudgeCopy(
      preferredAnalysts.map((result) => result.weakestArgument),
      fallback.weakestArgument,
    ),
    winner,
  };
}

async function handleSessionFeedbackRequest(
  config: AnalysisServerConfig,
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
  const providerKeys = getConfiguredProviderKeys(config);
  const configuredApiKeys = [...providerKeys.groq, ...providerKeys.featherless];

  if (configuredApiKeys.length === 0) {
    sendJson(res, 200, toMockFeedback(fallback));
    return;
  }

  try {
    const feedback = await enrichFeedbackWithLlm(providerKeys, payload, fallback);
    sendJson(res, 200, {
      feedback,
      mode: feedback.source === "groq" ? "groq" : "llm",
    } satisfies FeedbackResponse);
  } catch (error) {
    console.warn("[voiceforge] Session feedback fallback:", error);
    sendJson(res, 200, toMockFeedback(fallback));
  }
}

async function handleLiveMetricsRequest(
  config: AnalysisServerConfig,
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
  config: AnalysisServerConfig,
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
  config: AnalysisServerConfig,
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
  const providerKeys = getConfiguredProviderKeys(config);
  const configuredApiKeys = [...providerKeys.groq, ...providerKeys.featherless];

  if (configuredApiKeys.length === 0) {
    sendJson(res, 200, toMockDebateJudge(fallback));
    return;
  }

  try {
    const judge = await enrichDebateJudgeWithLlm(providerKeys, payload, fallback);
    sendJson(res, 200, {
      judge,
      mode: judge.source === "groq" ? "groq" : "llm",
    } satisfies DebateJudgeResponse);
  } catch (error) {
    console.warn("[voiceforge] Debate judge fallback:", error);
    sendJson(res, 200, toMockDebateJudge(fallback));
  }
}

export function createGroqFeedbackMiddleware(config: AnalysisServerConfig) {
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
