import { buildDeterministicFeedbackSummary } from "../../../lib/voice-feedback/analysis";
import type {
  FeedbackSummary,
  SessionAnalysisPayload,
} from "../../../lib/voice-feedback/contracts";
import { liveTranscriptSeed, type Scenario } from "@/shared/data/mock";

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
  const scenario = value.scenario;
  const transcript = value.transcript;

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
    durationSeconds,
    scenario: {
      description: scenario.description,
      focus: scenario.focus,
      id: scenario.id,
      title: scenario.title,
    },
    transcript: parsedTranscript,
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
    durationSeconds: 92,
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
  };
}

export function createSessionSnapshot(
  payload: SessionAnalysisPayload,
): StoredSessionSnapshot {
  return {
    completedAt: new Date().toISOString(),
    id: `vf-${Date.now().toString(36)}`,
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
