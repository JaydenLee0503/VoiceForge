export type FeedbackSource = "deterministic" | "groq" | "mock";

export type SessionAnalysisScenario = {
  description: string;
  focus: string;
  id: string;
  title: string;
};

export type SessionTranscriptEntry = {
  id: string;
  role: "coach" | "user";
  text: string;
  timestamp: number;
};

export type SessionAnalysisPayload = {
  durationSeconds: number;
  scenario: SessionAnalysisScenario;
  transcript: SessionTranscriptEntry[];
};

export type FeedbackScores = {
  clarity: number;
  confidence: number;
  pace: number;
  eyeContactPresence: number;
  fillerWords: number;
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
