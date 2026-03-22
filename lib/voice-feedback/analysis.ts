import { mergePresenceScore } from "../../src/lib/scoring/nonVerbalScore";
import type {
  FeedbackScores,
  FeedbackSummary,
  LiveMetric,
  LiveMetricsSummary,
  SessionAnalysisPayload,
  SessionTranscriptEntry,
  TranscriptHighlight,
  VerbalMetricsSummary,
} from "./contracts";

type EntrySpeechStats = {
  entry: SessionTranscriptEntry;
  fillerCount: number;
  score: number;
  wordCount: number;
};

type SessionComputedStats = {
  averageWordsPerUtterance: number;
  durationSeconds: number;
  fillerCount: number;
  fillerWordBreakdown: Record<string, number>;
  hedgeCount: number;
  questionCount: number;
  scores: FeedbackScores;
  topMoment: EntrySpeechStats | null;
  totalUserWords: number;
  weakestMoment: EntrySpeechStats | null;
  wordsPerMinute: number;
};

const FILLER_PATTERNS = [
  { key: "um", pattern: /\bum\b/gi },
  { key: "uh", pattern: /\buh\b/gi },
  { key: "like", pattern: /\blike\b/gi },
  { key: "you know", pattern: /\byou know\b/gi },
  { key: "kind of", pattern: /\bkind of\b/gi },
  { key: "sort of", pattern: /\bsort of\b/gi },
  { key: "actually", pattern: /\bactually\b/gi },
] as const;

const HEDGE_PATTERNS = [
  /\bmaybe\b/gi,
  /\bjust\b/gi,
  /\bprobably\b/gi,
  /\bi think\b/gi,
  /\bi guess\b/gi,
] as const;

const ASSERTIVE_PATTERNS = [
  /\bwill\b/gi,
  /\bcan\b/gi,
  /\bhelps?\b/gi,
  /\bsolve(?:s|d)?\b/gi,
  /\bbuild(?:s|ing|t)?\b/gi,
  /\bimprove(?:s|d)?\b/gi,
  /\bmatters?\b/gi,
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value, 40, 98));
}

function countPattern(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getUserEntries(payload: SessionAnalysisPayload) {
  return payload.transcript.filter(
    (entry) => entry.role === "user" && entry.text.trim().length > 0,
  );
}

function buildFillerWordBreakdown(text: string) {
  return FILLER_PATTERNS.reduce<Record<string, number>>((breakdown, filler) => {
    const count = countPattern(text, filler.pattern);

    if (count > 0) {
      breakdown[filler.key] = count;
    }

    return breakdown;
  }, {});
}

function countHedges(text: string) {
  return HEDGE_PATTERNS.reduce(
    (total, pattern) => total + countPattern(text, pattern),
    0,
  );
}

function countAssertivePhrases(text: string) {
  return ASSERTIVE_PATTERNS.reduce(
    (total, pattern) => total + countPattern(text, pattern),
    0,
  );
}

function getDurationSeconds(payload: SessionAnalysisPayload) {
  if (payload.durationSeconds > 0) {
    return payload.durationSeconds;
  }

  const firstTimestamp = payload.transcript[0]?.timestamp;
  const lastTimestamp = payload.transcript[payload.transcript.length - 1]?.timestamp;

  if (
    typeof firstTimestamp === "number" &&
    typeof lastTimestamp === "number" &&
    lastTimestamp > firstTimestamp
  ) {
    return Math.round((lastTimestamp - firstTimestamp) / 1000);
  }

  return 0;
}

function buildEntrySpeechStats(entry: SessionTranscriptEntry): EntrySpeechStats {
  const fillerCount = FILLER_PATTERNS.reduce(
    (total, filler) => total + countPattern(entry.text, filler.pattern),
    0,
  );
  const wordCount = countWords(entry.text);
  const clarityBonus = Math.min(wordCount, 22);
  const score = clarityBonus - fillerCount * 6;

  return {
    entry,
    fillerCount,
    score,
    wordCount,
  };
}

function formatTimestamp(payload: SessionAnalysisPayload, timestamp: number) {
  const sessionStart = payload.transcript[0]?.timestamp ?? timestamp;
  const elapsedSeconds = Math.max(
    0,
    Math.round((timestamp - sessionStart) / 1000),
  );
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildHighlights(
  payload: SessionAnalysisPayload,
  stats: SessionComputedStats,
): TranscriptHighlight[] {
  const highlights: TranscriptHighlight[] = [];

  if (stats.topMoment) {
    highlights.push({
      label: "Best moment",
      quote: stats.topMoment.entry.text,
      timestamp: formatTimestamp(payload, stats.topMoment.entry.timestamp),
    });
  }

  if (stats.weakestMoment && stats.weakestMoment.entry.id !== stats.topMoment?.entry.id) {
    highlights.push({
      label:
        stats.weakestMoment.fillerCount > 0
          ? "Tighten this transition"
          : "Sharper finish",
      quote: stats.weakestMoment.entry.text,
      timestamp: formatTimestamp(payload, stats.weakestMoment.entry.timestamp),
    });
  }

  if (highlights.length === 0) {
    const fallbackEntry = payload.transcript.find((entry) => entry.text.trim().length > 0);

    if (fallbackEntry) {
      highlights.push({
        label:
          fallbackEntry.role === "user"
            ? "Session moment"
            : fallbackEntry.role === "opponent"
              ? "Opponent line"
              : "Coach cue",
        quote: fallbackEntry.text,
        timestamp: formatTimestamp(payload, fallbackEntry.timestamp),
      });
    }
  }

  return highlights.slice(0, 2);
}

function buildMetricStatus(score: number, label: LiveMetric["label"]) {
  if (label === "Pace") {
    if (score >= 85) {
      return "Well paced";
    }

    if (score >= 72) {
      return "Mostly steady";
    }

    return "Slow transitions";
  }

  if (score >= 85) {
    return "Strong";
  }

  if (score >= 72) {
    return "Settling";
  }

  return "Needs support";
}

function buildCoachCue(
  payload: SessionAnalysisPayload,
  stats: SessionComputedStats,
) {
  const weakestMetric = Object.entries(stats.scores)
    .filter(([label]) => label !== "fillerWords")
    .sort((left, right) => left[1] - right[1])[0]?.[0];

  if (weakestMetric === "pace") {
    return "Let each key idea land before you move to the next one.";
  }

  if (weakestMetric === "confidence") {
    return "Keep the wording direct and finish the final clause with conviction.";
  }

  if (weakestMetric === "clarity") {
    return "Trim one extra phrase from each response and keep the point up front.";
  }

  if (weakestMetric === "eyeContactPresence") {
    return "Stay physically still on the next answer so the message feels more grounded.";
  }

  return `Keep your ${payload.scenario.focus.toLowerCase()} front and center on the next response.`;
}

function buildLiveSignals(
  payload: SessionAnalysisPayload,
  stats: SessionComputedStats,
) {
  const averageCoreScore = Math.round(
    (stats.scores.clarity + stats.scores.confidence + stats.scores.pace) / 3,
  );
  const liveSignal =
    averageCoreScore >= 84
      ? "Stable and rising"
      : averageCoreScore >= 72
        ? "Stable"
        : "Still settling";

  const primaryAim =
    stats.scores.pace < stats.scores.clarity &&
    stats.scores.pace < stats.scores.confidence
      ? "Create one clean pause"
      : stats.scores.confidence < stats.scores.clarity
        ? "Sound more decisive"
        : `Protect ${payload.scenario.focus.toLowerCase()}`;

  return [
    { label: "Live signal", value: liveSignal },
    { label: "Primary aim", value: primaryAim },
  ];
}

export function computeSessionStats(
  payload: SessionAnalysisPayload,
): SessionComputedStats {
  const userEntries = getUserEntries(payload);
  const userText = userEntries.map((entry) => entry.text).join(" ");
  const totalUserWords = countWords(userText);
  const fillerWordBreakdown = buildFillerWordBreakdown(userText);
  const fillerCount = Object.values(fillerWordBreakdown).reduce(
    (total, count) => total + count,
    0,
  );
  const durationSeconds = Math.max(getDurationSeconds(payload), 1);
  const wordsPerMinute = Math.round((totalUserWords / durationSeconds) * 60);
  const hedgeCount = countHedges(userText);
  const questionCount = countPattern(userText, /\?/g);
  const sentenceCount = Math.max(
    userText.split(/[.!?]+/).filter((segment) => segment.trim().length > 0).length,
    userEntries.length,
    1,
  );
  const averageWordsPerSentence = totalUserWords / sentenceCount;
  const averageWordsPerUtterance =
    totalUserWords / Math.max(userEntries.length, 1);
  const uniqueRatio =
    new Set(
      userText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean),
    ).size / Math.max(totalUserWords, 1);
  const fillerRatio = fillerCount / Math.max(totalUserWords, 1);
  const assertiveCount = countAssertivePhrases(userText);
  const paceDistance = Math.abs(wordsPerMinute - 135);
  const sentenceShapePenalty =
    averageWordsPerSentence > 20
      ? (averageWordsPerSentence - 20) * 1.4
      : averageWordsPerSentence < 5
        ? (5 - averageWordsPerSentence) * 2.5
        : 0;

  const clarity = roundScore(
    66 +
      uniqueRatio * 24 +
      Math.min(userEntries.length * 3, 10) -
      fillerRatio * 160 -
      sentenceShapePenalty,
  );
  const confidence = roundScore(
    60 +
      Math.min(assertiveCount * 2.4, 16) +
      clamp(averageWordsPerUtterance, 6, 18) * 0.7 -
      fillerCount * 2.8 -
      hedgeCount * 2.2 -
      questionCount * 1.6,
  );
  const pace = roundScore(
    94 - Math.min(paceDistance * 0.55, 42) - Math.max(0, fillerCount - 1) * 1.5,
  );
  const transcriptDerivedPresence = roundScore(
    60 + clarity * 0.18 + confidence * 0.24 + pace * 0.12 - fillerCount * 1.5,
  );
  const eyeContactPresence = mergePresenceScore(
    transcriptDerivedPresence,
    payload.presence,
  );
  const fillerWords = roundScore(96 - fillerCount * 9 - fillerRatio * 180);

  const scoredEntries = userEntries.map(buildEntrySpeechStats).sort((left, right) => {
    if (right.score === left.score) {
      return right.wordCount - left.wordCount;
    }

    return right.score - left.score;
  });
  const weakestEntry = userEntries
    .map(buildEntrySpeechStats)
    .sort((left, right) => {
      if (right.fillerCount === left.fillerCount) {
        return left.score - right.score;
      }

      return right.fillerCount - left.fillerCount;
    })[0] ?? null;

  return {
    averageWordsPerUtterance,
    durationSeconds,
    fillerCount,
    fillerWordBreakdown,
    hedgeCount,
    questionCount,
    scores: {
      clarity,
      confidence,
      eyeContactPresence,
      fillerWords,
      pace,
    },
    topMoment: scoredEntries[0] ?? null,
    totalUserWords,
    weakestMoment: weakestEntry,
    wordsPerMinute,
  };
}

function buildCoachSummary(
  payload: SessionAnalysisPayload,
  stats: SessionComputedStats,
) {
  const strongestMetric = Object.entries(stats.scores)
    .filter(([label]) => label !== "fillerWords")
    .sort((left, right) => right[1] - left[1])[0]?.[0];

  if (strongestMetric === "pace") {
    return "Your pacing stayed controlled, and the message felt easier to follow.";
  }

  if (strongestMetric === "confidence") {
    return "You sounded steadier as the session progressed, especially when the point was direct.";
  }

  if (strongestMetric === "clarity") {
    return "Your clearest moments were direct and easy to track from start to finish.";
  }

  return `This was a useful rep for ${payload.scenario.focus.toLowerCase()}, with a clear next adjustment to make.`;
}

function buildBestMoment(
  payload: SessionAnalysisPayload,
  stats: SessionComputedStats,
) {
  if (stats.topMoment) {
    const quote = stats.topMoment.entry.text;

    if (quote.length <= 120) {
      return `Your strongest stretch was the direct explanation at ${formatTimestamp(payload, stats.topMoment.entry.timestamp)}.`;
    }
  }

  return "Your strongest stretch came when the message stayed direct and uncluttered.";
}

function buildImprovementArea(stats: SessionComputedStats) {
  if (stats.fillerCount >= 3) {
    return "Filler words showed up in transitions. Replace one of them with a deliberate pause.";
  }

  if (stats.scores.pace < 72) {
    return "The pace drifted under pressure. Leave a brief beat after each key point.";
  }

  if (stats.scores.confidence < 72) {
    return "Your point softened in a few places. Trim qualifiers and land the last phrase more firmly.";
  }

  return "Keep the next answer slightly tighter so the main idea lands even faster.";
}

function buildNextChallenge(
  payload: SessionAnalysisPayload,
  stats: SessionComputedStats,
) {
  if (stats.scores.confidence < 72) {
    return "Next round, answer with the same structure but remove one hedging phrase from each response.";
  }

  if (stats.scores.pace < 72) {
    return "Run the scenario again and add one clean pause before your final sentence.";
  }

  return `Keep practicing ${payload.scenario.focus.toLowerCase()} and make the opening one sentence tighter.`;
}

export function buildDeterministicFeedbackSummary(
  payload: SessionAnalysisPayload,
): FeedbackSummary {
  const stats = computeSessionStats(payload);

  return {
    bestMoment: buildBestMoment(payload, stats),
    coachSummary: buildCoachSummary(payload, stats),
    fillerWordBreakdown: stats.fillerWordBreakdown,
    highlights: buildHighlights(payload, stats),
    improvementArea: buildImprovementArea(stats),
    model: null,
    nextChallenge: buildNextChallenge(payload, stats),
    scores: stats.scores,
    source: "deterministic",
  };
}

export function buildVerbalMetricsSummary(
  payload: SessionAnalysisPayload,
): VerbalMetricsSummary {
  const stats = computeSessionStats(payload);

  return {
    averageWordsPerUtterance: Math.round(stats.averageWordsPerUtterance * 10) / 10,
    fillerCount: stats.fillerCount,
    fillerWordBreakdown: stats.fillerWordBreakdown,
    hedgeCount: stats.hedgeCount,
    questionCount: stats.questionCount,
    scores: stats.scores,
    totalUserWords: stats.totalUserWords,
    wordsPerMinute: stats.wordsPerMinute,
  };
}

function buildLiveMetrics(stats: SessionComputedStats): LiveMetric[] {
  return [
    {
      label: "Clarity",
      status: buildMetricStatus(stats.scores.clarity, "Clarity"),
      tone: "cyan",
      value: stats.scores.clarity,
    },
    {
      label: "Confidence",
      status: buildMetricStatus(stats.scores.confidence, "Confidence"),
      tone: "emerald",
      value: stats.scores.confidence,
    },
    {
      label: "Pace",
      status: buildMetricStatus(stats.scores.pace, "Pace"),
      tone: "violet",
      value: stats.scores.pace,
    },
  ];
}

export function buildDeterministicLiveMetricsSummary(
  payload: SessionAnalysisPayload,
): LiveMetricsSummary {
  const stats = computeSessionStats(payload);

  return {
    coachCue: buildCoachCue(payload, stats),
    metrics: buildLiveMetrics(stats),
    model: null,
    signals: buildLiveSignals(payload, stats),
    source: "deterministic",
    updatedAt: Date.now(),
  };
}

export function buildPromptSnapshot(payload: SessionAnalysisPayload) {
  const verbalMetrics = payload.verbalMetrics ?? buildVerbalMetricsSummary(payload);
  const sessionStats = computeSessionStats(payload);
  const transcriptExcerpt = payload.transcript
    .slice(-10)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
    .join("\n");

  return {
    averageWordsPerUtterance: verbalMetrics.averageWordsPerUtterance,
    cameraRecording:
      payload.cameraRecording
        ? {
            durationMs: payload.cameraRecording.durationMs,
            hasAudio: payload.cameraRecording.hasAudio,
            source: payload.cameraRecording.source,
          }
        : null,
    customPracticeSettings: payload.customPracticeSettings ?? null,
    durationSeconds: sessionStats.durationSeconds,
    fillerWordBreakdown: verbalMetrics.fillerWordBreakdown,
    generatedQuestionCount: payload.generatedQuestions?.length ?? 0,
    highlights: buildHighlights(payload, sessionStats),
    paceWordsPerMinute: verbalMetrics.wordsPerMinute,
    presenceReason: payload.presence?.reason ?? null,
    presenceScore: payload.presence?.nonVerbalScore ?? null,
    presenceStatus: payload.presence?.status ?? "unavailable",
    presenceSummary: payload.presence?.summary ?? null,
    questionCount: verbalMetrics.questionCount,
    scenario: payload.scenario,
    scores: verbalMetrics.scores,
    totalUserWords: verbalMetrics.totalUserWords,
    transcriptExcerpt,
  };
}
