// lib/contracts/session.ts
export type SessionScenario = {
  id: string;
  category: "everyday-confidence" | "high-stakes-speaking" | "expression-identity";
  title: string;
  prompt: string;
};

export type TranscriptTurn = {
  id: string;
  speaker: "user" | "coach";
  text: string;
  startMs?: number;
  endMs?: number;
};

export type SessionRecord = {
  id: string;
  scenarioId: string;
  startedAt: string;
  endedAt?: string;
  turns: TranscriptTurn[];
};