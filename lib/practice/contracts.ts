import type {
  CustomPracticeIntensity,
  CustomPracticeSettings,
  SessionQuestionPrompt,
} from "../voice-feedback/contracts";

export type CustomPracticeQuestionRequest = Pick<
  CustomPracticeSettings,
  "audience" | "goal" | "intensity" | "questionCount" | "topic"
>;

export type CustomPracticeQuestionResponse = {
  intro: string;
  model: string | null;
  questions: SessionQuestionPrompt[];
  source: "groq" | "mock";
};

export { type CustomPracticeIntensity };
