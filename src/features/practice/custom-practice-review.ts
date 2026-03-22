import { buildDisplayTranscript, buildRawTranscript } from "@/lib/transcript/formatting";
import type {
  SessionAnalysisPayload,
  SessionQuestionPrompt,
  SessionTranscriptEntry,
} from "../../../lib/voice-feedback/contracts";

export type CustomPracticeQuestionReviewSeed = {
  answerText: string;
  payload: SessionAnalysisPayload;
  prompt: SessionQuestionPrompt;
  questionIndex: number;
  sessionStartTimestamp: number | null;
  windowEndTimestamp: number | null;
  windowStartTimestamp: number | null;
};

function createPromptEntry(
  prompt: SessionQuestionPrompt,
  fallbackTimestamp: number,
): SessionTranscriptEntry {
  return {
    id: `prompt-${prompt.id}`,
    role: "coach",
    text: prompt.text,
    timestamp: fallbackTimestamp,
  };
}

function findPromptEntryIndex(
  transcript: SessionTranscriptEntry[],
  prompt: SessionQuestionPrompt,
  questionIndex: number,
) {
  const promptEntryId = `prompt-${prompt.id}`;
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

export function buildCustomPracticeQuestionReviewSeeds(
  sessionPayload: SessionAnalysisPayload,
): CustomPracticeQuestionReviewSeed[] {
  const customPracticeSettings = sessionPayload.customPracticeSettings;
  const prompts = sessionPayload.generatedQuestions ?? [];

  if (!customPracticeSettings || prompts.length === 0 || sessionPayload.transcript.length === 0) {
    return [];
  }

  const transcript = sessionPayload.transcript;
  const firstUserTimestamp =
    transcript.find((entry) => entry.role === "user")?.timestamp ?? null;
  const fallbackTimestamp = transcript[0]?.timestamp ?? Date.now();

  return prompts.map((prompt, questionIndex) => {
    const startIndex = findPromptEntryIndex(transcript, prompt, questionIndex);
    const nextStartIndex =
      questionIndex + 1 < prompts.length
        ? findPromptEntryIndex(transcript, prompts[questionIndex + 1], questionIndex + 1)
        : -1;
    const segmentEntries =
      startIndex >= 0
        ? transcript.slice(startIndex, nextStartIndex > startIndex ? nextStartIndex : undefined)
        : [createPromptEntry(prompt, fallbackTimestamp + questionIndex)];
    const userEntries = segmentEntries.filter((entry) => entry.role === "user");
    const answerText = userEntries.map((entry) => entry.text.trim()).filter(Boolean).join(" ");
    const answerStartTimestamp = userEntries[0]?.timestamp ?? null;
    const answerEndTimestamp = userEntries[userEntries.length - 1]?.timestamp ?? null;
    const estimatedDurationSeconds =
      answerStartTimestamp !== null &&
      answerEndTimestamp !== null &&
      answerEndTimestamp > answerStartTimestamp
        ? Math.max(1, Math.round((answerEndTimestamp - answerStartTimestamp) / 1000))
        : customPracticeSettings.answerTime;

    return {
      answerText,
      payload: {
        ...sessionPayload,
        customPracticeSettings,
        displayTranscript: buildDisplayTranscript(segmentEntries),
        durationSeconds: estimatedDurationSeconds,
        generatedQuestions: [prompt],
        rawTranscript: buildRawTranscript(segmentEntries),
        transcript: segmentEntries,
        verbalMetrics: null,
      },
      prompt,
      questionIndex,
      sessionStartTimestamp: firstUserTimestamp,
      windowEndTimestamp: answerEndTimestamp,
      windowStartTimestamp: answerStartTimestamp,
    } satisfies CustomPracticeQuestionReviewSeed;
  });
}
