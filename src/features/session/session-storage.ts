import { createMockPresenceSessionResult } from "@/lib/scoring/nonVerbalScore";
import { liveTranscriptSeed, type Scenario } from "@/shared/data/mock";
import type { PresenceSessionResult } from "@/types/presence";
import { buildDeterministicFeedbackSummary } from "../../../lib/voice-feedback/analysis";
import type {
  CustomPracticeSettings,
  FeedbackSummary,
  SessionAnalysisPayload,
  SessionCameraRecording,
  SessionQuestionPrompt,
  VerbalMetricsSummary,
} from "../../../lib/voice-feedback/contracts";

const LAST_SESSION_STORAGE_KEY = "voiceforge-last-session";
const SESSION_HISTORY_STORAGE_KEY = "voiceforge-session-history";

export type StoredSessionSnapshot = {
  completedAt: string;
  id: string;
  payload: SessionAnalysisPayload;
};

export type StoredSessionHistoryEntry = StoredSessionSnapshot & {
  feedback: FeedbackSummary;
};

export type StoredSessionHistoryListItem = {
  clarity: number;
  confidence: number;
  date: string;
  duration: string;
  id: string;
  scenario: string;
  scenarioId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSessionPayload(value: unknown): SessionAnalysisPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const durationSeconds = value.durationSeconds;
  const cameraRecording =
    "cameraRecording" in value ? parseSessionCameraRecording(value.cameraRecording) : null;
  const customPracticeSettings =
    "customPracticeSettings" in value
      ? parseCustomPracticeSettings(value.customPracticeSettings)
      : null;
  const displayTranscript =
    "displayTranscript" in value ? parseOptionalString(value.displayTranscript) : null;
  const presence = "presence" in value ? parsePresenceSessionResult(value.presence) : null;
  const rawTranscript =
    "rawTranscript" in value ? parseOptionalString(value.rawTranscript) : null;
  const scenario = value.scenario;
  const transcript = value.transcript;
  const generatedQuestions =
    "generatedQuestions" in value
      ? parseGeneratedQuestions(value.generatedQuestions)
      : null;
  const verbalMetrics =
    "verbalMetrics" in value ? parseVerbalMetrics(value.verbalMetrics) : null;

  if (
    typeof durationSeconds !== "number" ||
    !isRecord(scenario) ||
    typeof scenario.id !== "string" ||
    typeof scenario.title !== "string" ||
    typeof scenario.description !== "string" ||
    typeof scenario.focus !== "string" ||
    !Array.isArray(transcript)
  ) {
    return null;
  }

  const parsedTranscript = transcript
    .map((entry) => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== "string" ||
        typeof entry.role !== "string" ||
        typeof entry.text !== "string" ||
        typeof entry.timestamp !== "number" ||
        (entry.role !== "coach" && entry.role !== "user")
      ) {
        return null;
      }

      return {
        id: entry.id,
        role: entry.role,
        text: entry.text,
        timestamp: entry.timestamp,
      };
    })
    .filter((entry): entry is SessionAnalysisPayload["transcript"][number] => entry !== null);

  return {
    cameraRecording,
    customPracticeSettings,
    displayTranscript,
    durationSeconds,
    generatedQuestions,
    presence,
    rawTranscript,
    scenario: {
      description: scenario.description,
      focus: scenario.focus,
      id: scenario.id,
      title: scenario.title,
    },
    transcript: parsedTranscript,
    verbalMetrics,
  };
}

function parseOptionalString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : null;
}

function parseSessionCameraRecording(value: unknown): SessionCameraRecording | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.durationMs !== "number" ||
    typeof value.hasAudio !== "boolean" ||
    typeof value.height !== "number" ||
    typeof value.id !== "string" ||
    typeof value.mimeType !== "string" ||
    value.source !== "browser_media_recorder" ||
    typeof value.width !== "number"
  ) {
    return null;
  }

  return {
    durationMs: value.durationMs,
    hasAudio: value.hasAudio,
    height: value.height,
    id: value.id,
    mimeType: value.mimeType,
    source: value.source,
    width: value.width,
  };
}

function parsePresenceSessionResult(value: unknown): PresenceSessionResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const summary = value.summary;
  const heuristics = value.heuristics;
  const reason = value.reason;
  const validReasons = [
    "analysis_failed",
    "camera_denied",
    "camera_disabled",
    "camera_error",
    "camera_unsupported",
    "model_load_failed",
    "no_session_frames",
    "recording_missing",
  ] as const;

  if (
    !isRecord(summary) ||
    !Array.isArray(heuristics) ||
    !heuristics.every((entry) => typeof entry === "string") ||
    (value.status !== "ready" && value.status !== "unavailable") ||
    (reason !== null &&
      (typeof reason !== "string" ||
        !validReasons.includes(reason as (typeof validReasons)[number]))) ||
    (value.nonVerbalScore !== null && typeof value.nonVerbalScore !== "number") ||
    typeof summary.faceDetectedFrames !== "number" ||
    typeof summary.facePresencePct !== "number" ||
    typeof summary.forwardAttentionPct !== "number" ||
    typeof summary.headStabilityPct !== "number" ||
    typeof summary.sampledFrames !== "number" ||
    typeof summary.speakingFrames !== "number" ||
    typeof summary.speakingMouthActivityPct !== "number"
  ) {
    return null;
  }

  const parsedReason = reason as PresenceSessionResult["reason"];

  return {
    heuristics,
    nonVerbalScore: value.nonVerbalScore,
    reason: parsedReason,
    status: value.status,
    summary: {
      faceDetectedFrames: summary.faceDetectedFrames,
      facePresencePct: summary.facePresencePct,
      forwardAttentionPct: summary.forwardAttentionPct,
      headStabilityPct: summary.headStabilityPct,
      sampledFrames: summary.sampledFrames,
      speakingFrames: summary.speakingFrames,
      speakingMouthActivityPct: summary.speakingMouthActivityPct,
    },
  };
}

function parseCustomPracticeSettings(value: unknown): CustomPracticeSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.answerTime !== "number" ||
    typeof value.audience !== "string" ||
    typeof value.goal !== "string" ||
    (value.intensity !== "clarity" &&
      value.intensity !== "exploratory" &&
      value.intensity !== "pressure-test") ||
    typeof value.prepTime !== "number" ||
    typeof value.questionCount !== "number" ||
    typeof value.topic !== "string"
  ) {
    return null;
  }

  return {
    answerTime: value.answerTime,
    audience: value.audience,
    goal: value.goal,
    intensity: value.intensity,
    prepTime: value.prepTime,
    questionCount: value.questionCount,
    topic: value.topic,
  };
}

function parseGeneratedQuestions(value: unknown): SessionQuestionPrompt[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((question) => {
      if (
        !isRecord(question) ||
        typeof question.id !== "string" ||
        typeof question.text !== "string"
      ) {
        return null;
      }

      return {
        id: question.id,
        text: question.text,
      };
    })
    .filter((question): question is SessionQuestionPrompt => question !== null);
}

function parseVerbalMetrics(value: unknown): VerbalMetricsSummary | null {
  if (!isRecord(value) || !isRecord(value.scores) || !isRecord(value.fillerWordBreakdown)) {
    return null;
  }

  if (
    typeof value.averageWordsPerUtterance !== "number" ||
    typeof value.fillerCount !== "number" ||
    typeof value.hedgeCount !== "number" ||
    typeof value.questionCount !== "number" ||
    typeof value.totalUserWords !== "number" ||
    typeof value.wordsPerMinute !== "number" ||
    typeof value.scores.clarity !== "number" ||
    typeof value.scores.confidence !== "number" ||
    typeof value.scores.eyeContactPresence !== "number" ||
    typeof value.scores.fillerWords !== "number" ||
    typeof value.scores.pace !== "number"
  ) {
    return null;
  }

  const fillerWordBreakdown = Object.entries(value.fillerWordBreakdown).reduce<
    Record<string, number>
  >((breakdown, [word, count]) => {
    if (typeof count === "number") {
      breakdown[word] = count;
    }

    return breakdown;
  }, {});

  return {
    averageWordsPerUtterance: value.averageWordsPerUtterance,
    fillerCount: value.fillerCount,
    fillerWordBreakdown,
    hedgeCount: value.hedgeCount,
    questionCount: value.questionCount,
    scores: {
      clarity: value.scores.clarity,
      confidence: value.scores.confidence,
      eyeContactPresence: value.scores.eyeContactPresence,
      fillerWords: value.scores.fillerWords,
      pace: value.scores.pace,
    },
    totalUserWords: value.totalUserWords,
    wordsPerMinute: value.wordsPerMinute,
  };
}

function parseFeedbackSummary(value: unknown): FeedbackSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const scores = value.scores;
  const highlights = value.highlights;
  const fillerWordBreakdown = value.fillerWordBreakdown;

  if (
    typeof value.bestMoment !== "string" ||
    typeof value.coachSummary !== "string" ||
    typeof value.improvementArea !== "string" ||
    typeof value.nextChallenge !== "string" ||
    !isRecord(scores) ||
    typeof scores.clarity !== "number" ||
    typeof scores.confidence !== "number" ||
    typeof scores.pace !== "number" ||
    typeof scores.eyeContactPresence !== "number" ||
    typeof scores.fillerWords !== "number" ||
    !Array.isArray(highlights) ||
    !isRecord(fillerWordBreakdown) ||
    (value.model !== null && typeof value.model !== "string") ||
    (value.source !== "deterministic" &&
      value.source !== "groq" &&
      value.source !== "mock")
  ) {
    return null;
  }

  const parsedHighlights = highlights
    .map((highlight) => {
      if (
        !isRecord(highlight) ||
        typeof highlight.label !== "string" ||
        typeof highlight.quote !== "string" ||
        typeof highlight.timestamp !== "string"
      ) {
        return null;
      }

      return {
        label: highlight.label,
        quote: highlight.quote,
        timestamp: highlight.timestamp,
      };
    })
    .filter((highlight): highlight is FeedbackSummary["highlights"][number] => highlight !== null);

  const parsedBreakdown = Object.entries(fillerWordBreakdown).reduce<
    Record<string, number>
  >((breakdown, [word, count]) => {
    if (typeof count === "number") {
      breakdown[word] = count;
    }

    return breakdown;
  }, {});

  return {
    bestMoment: value.bestMoment,
    coachSummary: value.coachSummary,
    fillerWordBreakdown: parsedBreakdown,
    highlights: parsedHighlights,
    improvementArea: value.improvementArea,
    model: value.model,
    nextChallenge: value.nextChallenge,
    scores: {
      clarity: scores.clarity,
      confidence: scores.confidence,
      eyeContactPresence: scores.eyeContactPresence,
      fillerWords: scores.fillerWords,
      pace: scores.pace,
    },
    source: value.source,
  };
}

function deriveSnapshotId(payload: SessionAnalysisPayload) {
  const seed = payload.transcript[0]?.timestamp ?? Date.now();
  return `vf-${seed.toString(36)}`;
}

function deriveCompletedAt(payload: SessionAnalysisPayload) {
  const timestamp =
    payload.transcript[payload.transcript.length - 1]?.timestamp ?? Date.now();
  return new Date(timestamp).toISOString();
}

function parseSessionSnapshot(value: unknown): StoredSessionSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  if ("payload" in value) {
    const payload = parseSessionPayload(value.payload);

    if (
      !payload ||
      typeof value.id !== "string" ||
      typeof value.completedAt !== "string"
    ) {
      return null;
    }

    return {
      completedAt: value.completedAt,
      id: value.id,
      payload,
    };
  }

  const payload = parseSessionPayload(value);

  if (!payload) {
    return null;
  }

  return {
    completedAt: deriveCompletedAt(payload),
    id: deriveSnapshotId(payload),
    payload,
  };
}

function parseHistoryEntry(value: unknown): StoredSessionHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const snapshot = parseSessionSnapshot(value);
  const feedback = parseFeedbackSummary(value.feedback);

  if (!snapshot || !feedback) {
    return null;
  }

  return {
    ...snapshot,
    feedback,
  };
}

function readStorageValue(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(storageKey);
}

function writeStorageValue(storageKey: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, value);
}

function removeStorageValue(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

function sortHistoryEntries(entries: StoredSessionHistoryEntry[]) {
  return [...entries].sort(
    (left, right) =>
      new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
  );
}

export function createMockSessionPayload(
  scenario: Scenario,
): SessionAnalysisPayload {
  const now = Date.now();

  return {
    cameraRecording: null,
    customPracticeSettings: null,
    displayTranscript: null,
    durationSeconds: 92,
    generatedQuestions: null,
    presence: createMockPresenceSessionResult(),
    rawTranscript: null,
    scenario: {
      description: scenario.description,
      focus: scenario.focus,
      id: scenario.id,
      title: scenario.title,
    },
    transcript: liveTranscriptSeed.map((entry, index) => ({
      id: `mock-results-${index}`,
      role: entry.role,
        text: entry.text,
        timestamp: now + index * 22000,
      })),
    verbalMetrics: null,
  };
}

export function createSessionSnapshot(
  payload: SessionAnalysisPayload,
  sessionId = `vf-${Date.now().toString(36)}`,
): StoredSessionSnapshot {
  return {
    completedAt: new Date().toISOString(),
    id: sessionId,
    payload,
  };
}

export function loadLastSessionSnapshot() {
  const storedValue = readStorageValue(LAST_SESSION_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return parseSessionSnapshot(JSON.parse(storedValue));
  } catch {
    removeStorageValue(LAST_SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveLastSessionSnapshot(snapshot: StoredSessionSnapshot) {
  writeStorageValue(
    LAST_SESSION_STORAGE_KEY,
    JSON.stringify(snapshot),
  );
}

export function loadSessionHistory() {
  const storedValue = readStorageValue(SESSION_HISTORY_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      removeStorageValue(SESSION_HISTORY_STORAGE_KEY);
      return [];
    }

    return sortHistoryEntries(
      parsedValue
        .map((entry) => parseHistoryEntry(entry))
        .filter((entry): entry is StoredSessionHistoryEntry => entry !== null),
    );
  } catch {
    removeStorageValue(SESSION_HISTORY_STORAGE_KEY);
    return [];
  }
}

export function loadSessionHistoryEntry(sessionId: string) {
  return loadSessionHistory().find((entry) => entry.id === sessionId) ?? null;
}

export function upsertSessionHistoryEntry(entry: StoredSessionHistoryEntry) {
  const existingEntries = loadSessionHistory().filter(
    (currentEntry) => currentEntry.id !== entry.id,
  );
  const nextEntries = sortHistoryEntries([entry, ...existingEntries]);

  writeStorageValue(
    SESSION_HISTORY_STORAGE_KEY,
    JSON.stringify(nextEntries),
  );
}

export function buildSessionHistoryEntry(
  snapshot: StoredSessionSnapshot,
  feedback = buildDeterministicFeedbackSummary(snapshot.payload),
): StoredSessionHistoryEntry {
  return {
    ...snapshot,
    feedback,
  };
}

export function formatSessionDuration(durationSeconds: number) {
  const safeDuration = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(safeDuration / 60);
  const seconds = safeDuration % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function formatSessionDate(isoDate: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function toSessionHistoryListItem(
  entry: StoredSessionHistoryEntry,
): StoredSessionHistoryListItem {
  return {
    clarity: entry.feedback.scores.clarity,
    confidence: entry.feedback.scores.confidence,
    date: formatSessionDate(entry.completedAt),
    duration: formatSessionDuration(entry.payload.durationSeconds),
    id: entry.id,
    scenario: entry.payload.scenario.title,
    scenarioId: entry.payload.scenario.id,
  };
}
