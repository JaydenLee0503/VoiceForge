// lib/contracts/feedback.ts
export type FeedbackScores = {
  clarity: number;
  confidence: number;
  pace: number;
  eyeContactPresence: number;
  fillerWords: number;
};

export type FeedbackSummary = {
  scores: FeedbackScores;
  bestMoment: string;
  improvementArea: string;
  nextChallenge: string;
  fillerWordBreakdown: Record<string, number>;
};