import type {
  CustomPracticeQuestionRequest,
  CustomPracticeQuestionResponse,
} from "../../../lib/practice/contracts";
import {
  buildDeterministicCustomPracticeQuestions,
} from "../../../lib/practice/question-generation";

const CUSTOM_PRACTICE_QUESTIONS_ENDPOINT = "/api/groq/custom-practice-questions";

export async function requestCustomPracticeQuestions(
  request: CustomPracticeQuestionRequest,
): Promise<CustomPracticeQuestionResponse> {
  const fallback = buildDeterministicCustomPracticeQuestions(request);

  try {
    const response = await fetch(CUSTOM_PRACTICE_QUESTIONS_ENDPOINT, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Custom practice request failed with ${response.status}.`);
    }

    return (await response.json()) as CustomPracticeQuestionResponse;
  } catch {
    return fallback;
  }
}
