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
  estimatedTimestamp: number;
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

type ResolvedCustomPracticeTiming = {
  answerEndTimestamp: number;
  answerStartTimestamp: number;
  prompt: NonNullable<SessionAnalysisPayload["generatedQuestions"]>[number];
  questionIndex: number;
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
  const customPracticeSpeakingDurationSeconds = getCustomPracticeSpeakingDurationSeconds(
    payload,
  );

  if (customPracticeSpeakingDurationSeconds !== null) {
    return customPracticeSpeakingDurationSeconds;
  }

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

function buildEntrySpeechStats(
  entry: SessionTranscriptEntry,
  estimatedTimestamp = entry.timestamp,
): EntrySpeechStats {
  const fillerCount = FILLER_PATTERNS.reduce(
    (total, filler) => total + countPattern(entry.text, filler.pattern),
    0,
  );
  const wordCount = countWords(entry.text);
  const clarityBonus = Math.min(wordCount, 22);
  const score = clarityBonus - fillerCount * 6;

  return {
    entry,
    estimatedTimestamp,
    fillerCount,
    score,
    wordCount,
  };
}

function formatTimestamp(payload: SessionAnalysisPayload, timestamp: number) {
  const sessionStart = getAnalysisStartTimestamp(payload) ?? timestamp;
  const elapsedSeconds = Math.max(
    0,
    Math.round((timestamp - sessionStart) / 1000),
  );
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clipSentence(text: string, maxLength = 120) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const trimmed = cleaned.slice(0, maxLength).trim();
  const lastSpace = trimmed.lastIndexOf(" ");

  return (lastSpace > 40 ? trimmed.slice(0, lastSpace) : trimmed).trim();
}

function stripTrailingPunctuation(text: string) {
  return text.replace(/[.!?]+$/g, "").trim();
}

function findPromptEntryIndex(
  transcript: SessionTranscriptEntry[],
  promptId: string,
  questionIndex: number,
) {
  const promptEntryId = `prompt-${promptId}`;
  const directIndex = transcript.findIndex((entry) => entry.id === promptEntryId);

  if (directIndex >= 0) {
    return directIndex;
  }

  let coachEntryCount = -1;

  return transcript.findIndex((entry) => {
    if (entry.role !== "coach") {
      return false;
    }

    coachEntryCount += 1;
    return coachEntryCount === questionIndex;
  });
}

function getRelevantCustomPracticeTimings(payload: SessionAnalysisPayload) {
  const timeline = payload.customPracticeTimeline;
  const prompts = payload.generatedQuestions ?? [];

  if (!timeline || prompts.length === 0) {
    return [] as ResolvedCustomPracticeTiming[];
  }

  return prompts
    .map((prompt, questionIndex) => ({
      prompt,
      questionIndex,
      question:
        timeline.questions.find((question) => question.questionId === prompt.id) ??
        timeline.questions.find((question) => question.questionIndex === questionIndex) ??
        null,
    }))
    .flatMap((entry) => {
      const answerStartTimestamp = entry.question?.answerStartTimestamp;
      const answerEndTimestamp = entry.question?.answerEndTimestamp;

      if (
        answerStartTimestamp === null ||
        answerStartTimestamp === undefined ||
        answerEndTimestamp === null ||
        answerEndTimestamp === undefined ||
        answerEndTimestamp <= answerStartTimestamp
      ) {
        return [];
      }

      return [
        {
          answerEndTimestamp,
          answerStartTimestamp,
          prompt: entry.prompt,
          questionIndex: entry.questionIndex,
        } satisfies ResolvedCustomPracticeTiming,
      ];
    });
}

function getAnalysisStartTimestamp(payload: SessionAnalysisPayload) {
  const customPracticeTimings = getRelevantCustomPracticeTimings(payload);

  if (customPracticeTimings.length > 0) {
    return Math.min(
      ...customPracticeTimings.map((entry) => entry.answerStartTimestamp),
    );
  }

  return payload.transcript[0]?.timestamp ?? null;
}

function getCustomPracticeSpeakingDurationSeconds(payload: SessionAnalysisPayload) {
  const customPracticeTimings = getRelevantCustomPracticeTimings(payload);

  if (customPracticeTimings.length === 0) {
    return null;
  }

  const totalDurationMs = customPracticeTimings.reduce(
    (total, entry) => total + (entry.answerEndTimestamp - entry.answerStartTimestamp),
    0,
  );

  return totalDurationMs > 0 ? Math.max(1, Math.round(totalDurationMs / 1000)) : null;
}

function buildCustomPracticeEntryTimestampMap(payload: SessionAnalysisPayload) {
  const prompts = payload.generatedQuestions ?? [];
  const transcript = payload.transcript;
  const customPracticeTimings = getRelevantCustomPracticeTimings(payload);
  const entryTimestampMap = new Map<string, number>();

  for (const { answerEndTimestamp, answerStartTimestamp, prompt, questionIndex } of customPracticeTimings) {
    const startIndex = findPromptEntryIndex(transcript, prompt.id, questionIndex);
    const nextStartIndex =
      questionIndex + 1 < prompts.length
        ? findPromptEntryIndex(transcript, prompts[questionIndex + 1]!.id, questionIndex + 1)
        : -1;
    const questionEntries =
      startIndex >= 0
        ? transcript.slice(startIndex, nextStartIndex > startIndex ? nextStartIndex : undefined)
        : transcript;
    const userEntries = questionEntries.filter(
      (entry) => entry.role === "user" && entry.text.trim().length > 0,
    );

    if (userEntries.length === 0) {
      continue;
    }

    const windowDurationMs = answerEndTimestamp - answerStartTimestamp;

    userEntries.forEach((entry, entryIndex) => {
      const relativePosition = (entryIndex + 0.5) / userEntries.length;
      entryTimestampMap.set(
        entry.id,
        answerStartTimestamp + Math.round(windowDurationMs * relativePosition),
      );
    });
  }

  return entryTimestampMap;
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
      timestamp: formatTimestamp(payload, stats.topMoment.estimatedTimestamp),
    });
  }

  if (stats.weakestMoment && stats.weakestMoment.entry.id !== stats.topMoment?.entry.id) {
    highlights.push({
      label:
        stats.weakestMoment.fillerCount > 0
          ? "Tighten this transition"
          : "Sharper finish",
      quote: stats.weakestMoment.entry.text,
      timestamp: formatTimestamp(payload, stats.weakestMoment.estimatedTimestamp),
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
  const customPracticeEntryTimestampMap = buildCustomPracticeEntryTimestampMap(payload);
  const speechStats = userEntries.map((entry) =>
    buildEntrySpeechStats(
      entry,
      customPracticeEntryTimestampMap.get(entry.id) ?? entry.timestamp,
    ),
  );
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
    60 +
      uniqueRatio * 21 +
      Math.min(userEntries.length * 2.5, 8) -
      fillerRatio * 180 -
      sentenceShapePenalty,
  );
  const confidence = roundScore(
    54 +
      Math.min(assertiveCount * 2.2, 15) +
      clamp(averageWordsPerUtterance, 6, 18) * 0.6 -
      fillerCount * 3.3 -
      hedgeCount * 2.7 -
      questionCount * 2,
  );
  const pace = roundScore(
    90 - Math.min(paceDistance * 0.62, 44) - Math.max(0, fillerCount - 1) * 2,
  );
  const transcriptDerivedPresence = roundScore(
    57 + clarity * 0.16 + confidence * 0.22 + pace * 0.1 - fillerCount * 1.8,
  );
  const eyeContactPresence = mergePresenceScore(
    transcriptDerivedPresence,
    payload.presence,
  );
  const fillerWords = roundScore(
    92 - fillerCount * 10 - fillerRatio * 190,
  );

  const scoredEntries = [...speechStats].sort((left, right) => {
    if (right.score === left.score) {
      return right.wordCount - left.wordCount;
    }

    return right.score - left.score;
  });
  const topMoment = scoredEntries[0] ?? null;
  const weakestEntry = [...speechStats]
    .sort((left, right) => {
      if (right.fillerCount === left.fillerCount) {
        return left.score - right.score;
      }

      return right.fillerCount - left.fillerCount;
    })
    .find((entry) => entry.entry.id !== topMoment?.entry.id) ?? null;

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
    topMoment,
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
    const excerpt = clipSentence(stats.topMoment.entry.text);
    const timestamp = formatTimestamp(payload, stats.topMoment.estimatedTimestamp);
    const detail =
      stats.topMoment.fillerCount === 0
        ? "The phrasing stayed clean, so the point landed without extra drag."
        : stats.topMoment.wordCount <= 18
          ? "It worked because the idea stayed compact enough to follow in one pass."
          : "It still landed because the explanation stayed specific instead of vague.";

    return `Your strongest moment was around ${timestamp}, when you said "${stripTrailingPunctuation(excerpt)}." ${detail}`;
  }

  return "Your strongest stretch came when the message stayed direct and specific, which made the main point easier to trust.";
}

function buildImprovementArea(
  payload: SessionAnalysisPayload,
  stats: SessionComputedStats,
) {
  if (stats.weakestMoment) {
    const excerpt = clipSentence(stats.weakestMoment.entry.text);
    const timestamp = formatTimestamp(payload, stats.weakestMoment.estimatedTimestamp);

    if (stats.weakestMoment.fillerCount >= 2 || stats.fillerCount >= 3) {
      return `The weakest stretch was around ${timestamp}, when "${stripTrailingPunctuation(excerpt)}" started to lose force through filler-heavy phrasing. Replace that kind of transition with one clean pause so the point sounds intentional instead of improvised.`;
    }

    if (stats.scores.confidence < 72 || stats.hedgeCount >= 2) {
      return `The softest stretch was around ${timestamp}, when "${stripTrailingPunctuation(excerpt)}" sounded more qualified than committed. Trim the hedging and land the final clause more firmly so the idea feels defended, not floated.`;
    }

    if (stats.scores.pace < 72) {
      return `The message slipped around ${timestamp}, when "${stripTrailingPunctuation(excerpt)}" moved faster than the idea could settle. Leave a short beat after the core claim so the listener can absorb it before you add the next point.`;
    }
  }

  if (stats.fillerCount >= 3) {
    return "Filler words showed up in the transitions often enough to weaken the authority of the point. Replace one of those fillers with a deliberate pause so the delivery feels more controlled.";
  }

  if (stats.scores.pace < 72) {
    return "The pace drifted once the answer picked up speed, so some ideas did not fully land. Leave a brief beat after each key point before moving on.";
  }

  if (stats.scores.confidence < 72) {
    return "Your point softened in a few places because the wording leaned cautious instead of decisive. Trim qualifiers and land the last phrase more firmly so the argument sounds owned.";
  }

  return "The main idea was there, but a few sentences still took too long to get to the point. Tighten the next answer slightly so the strongest claim lands earlier and with more force.";
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
    improvementArea: buildImprovementArea(payload, stats),
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
