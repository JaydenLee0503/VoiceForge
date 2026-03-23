import type { PresenceSessionResult } from "../../src/types/presence";

export type FeedbackSource =
  | "deterministic"
  | "featherless"
  | "groq"
  | "llm"
  | "mock";
export type CustomPracticeIntensity =
  | "clarity"
  | "exploratory"
  | "pressure-test";
export type SessionMode = "custom_practice" | "debate" | "scenario";
export type SessionTranscriptRole = "coach" | "opponent" | "user";
export type DebateStance = "affirm" | "oppose";
export type DebateDifficulty = "apex" | "challenger" | "foundation";
export type DebateRoundFormat = "balanced" | "rapid-fire" | "rebuttal-heavy";
export type DebateAudienceStyle = "boardroom" | "campus-forum" | "public-square";
export type DebateJudgeStyle = "analytical" | "balanced" | "skeptical";
export type DebateRoundType = "closing" | "opening" | "rebuttal";
export type DebateOutcome = "draw" | "lose" | "win";
export type DebateJudgeWinner = "draw" | "opponent" | "user";

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

export type CustomPracticeQuestionTiming = {
  answerEndTimestamp: number | null;
  answerStartTimestamp: number | null;
  questionId: string;
  questionIndex: number;
};

export type CustomPracticeTimeline = {
  questions: CustomPracticeQuestionTiming[];
  recordingStartedAt: number | null;
};

export type DebateRoundPlan = {
  id: string;
  label: string;
  order: number;
  prompt: string;
  seconds: number;
  type: DebateRoundType;
};

export type DebateSettings = {
  assignedStance: boolean;
  audienceStyle: DebateAudienceStyle;
  difficulty: DebateDifficulty;
  judgeStyle: DebateJudgeStyle;
  lengthMinutes: 1 | 2 | 3 | 4;
  opponentStance: DebateStance;
  prepSeconds: number;
  roundFormat: DebateRoundFormat;
  roundPlan: DebateRoundPlan[];
  topic: string;
  topicId: string | null;
  userStance: DebateStance;
};

export type SessionTranscriptEntry = {
  id: string;
  role: SessionTranscriptRole;
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

export type DebateCategoryScores = {
  argumentStrength: number;
  clarity: number;
  confidence: number;
  pace: number;
  persuasiveness: number;
  presence: number;
  rebuttalQuality: number;
  structure: number;
};

export type DebateRoundScore = {
  label: string;
  outcome: DebateOutcome;
  roundId: string;
  score: number;
  summary: string;
};

export type DebateRewards = {
  badge: string | null;
  points: number;
  streakBonus: number;
};

export type DebateJudgeSummary = {
  finalVerdict: string;
  model: string | null;
  rebuttalQuality: string;
  source: FeedbackSource;
  strongestArgument: string;
  suggestedImprovement: string;
  weakestArgument: string;
  winner: DebateJudgeWinner;
};

export type DebateResult = {
  bestMove: string;
  biggestWeakness: string;
  categoryScores: DebateCategoryScores;
  finalVerdict: string;
  judgeSummary: DebateJudgeSummary;
  nextRoundFocus: string;
  outcome: DebateOutcome;
  rewards: DebateRewards;
  roundScores: DebateRoundScore[];
  totalScore: number;
  updatedAt: number;
};

export type SessionAnalysisPayload = {
  cameraRecording?: SessionCameraRecording | null;
  customPracticeSettings?: CustomPracticeSettings | null;
  customPracticeTimeline?: CustomPracticeTimeline | null;
  debateResult?: DebateResult | null;
  debateSettings?: DebateSettings | null;
  displayTranscript?: string | null;
  durationSeconds: number;
  generatedQuestions?: SessionQuestionPrompt[] | null;
  mode?: SessionMode | null;
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
  mode: "groq" | "llm" | "mock";
};

export type DebateJudgeResponse = {
  judge: DebateJudgeSummary;
  mode: "groq" | "llm" | "mock";
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
