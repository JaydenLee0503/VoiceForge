import type { PresenceSessionResult } from "../../src/types/presence";

export type FeedbackSource = "deterministic" | "groq" | "mock";
export type CustomPracticeIntensity =
  | "clarity"
  | "exploratory"
  | "pressure-test";

export type SessionAnalysisScenario = {
  description: string;
  focus: string;
  id: string;
  title: string;
};

export type CustomPracticeSettings = {
  answerTime: number;
  audience: string;
  goal: string;
  intensity: CustomPracticeIntensity;
  prepTime: number;
  questionCount: number;
  topic: string;
};

export type SessionTranscriptEntry = {
  id: string;
  role: "coach" | "user";
  text: string;
  timestamp: number;
};

export type SessionQuestionPrompt = {
  id: string;
  text: string;
};

export type SessionCameraRecording = {
  durationMs: number;
  hasAudio: boolean;
  height: number;
  id: string;
  mimeType: string;
  source: "browser_media_recorder";
  width: number;
};

export type FeedbackScores = {
  clarity: number;
  confidence: number;
  pace: number;
  eyeContactPresence: number;
  fillerWords: number;
};

export type VerbalMetricsSummary = {
  averageWordsPerUtterance: number;
  fillerCount: number;
  fillerWordBreakdown: Record<string, number>;
  hedgeCount: number;
  questionCount: number;
  scores: FeedbackScores;
  totalUserWords: number;
  wordsPerMinute: number;
};

export type SessionAnalysisPayload = {
  cameraRecording?: SessionCameraRecording | null;
  customPracticeSettings?: CustomPracticeSettings | null;
  displayTranscript?: string | null;
  durationSeconds: number;
  generatedQuestions?: SessionQuestionPrompt[] | null;
  presence?: PresenceSessionResult | null;
  rawTranscript?: string | null;
  scenario: SessionAnalysisScenario;
  transcript: SessionTranscriptEntry[];
  verbalMetrics?: VerbalMetricsSummary | null;
};

export type TranscriptHighlight = {
  label: string;
  quote: string;
  timestamp: string;
};

export type FeedbackSummary = {
  bestMoment: string;
  coachSummary: string;
  fillerWordBreakdown: Record<string, number>;
  highlights: TranscriptHighlight[];
  improvementArea: string;
  model: string | null;
  nextChallenge: string;
  scores: FeedbackScores;
  source: FeedbackSource;
};

export type FeedbackResponse = {
  feedback: FeedbackSummary;
  mode: "groq" | "mock";
};

export type LiveMetricTone = "cyan" | "emerald" | "violet";

export type LiveMetric = {
  label: "Clarity" | "Confidence" | "Pace";
  status: string;
  tone: LiveMetricTone;
  value: number;
};

export type LivePerformanceSignal = {
  label: string;
  value: string;
};

export type LiveMetricsSummary = {
  coachCue: string;
  metrics: LiveMetric[];
  model: string | null;
  signals: LivePerformanceSignal[];
  source: FeedbackSource;
  updatedAt: number;
};

export type LiveMetricsResponse = {
  liveMetrics: LiveMetricsSummary;
  mode: "groq" | "mock";
};
