import type {
  CustomPracticeQuestionRequest,
  CustomPracticeQuestionResponse,
} from "./contracts";

function toQuestionText(
  request: CustomPracticeQuestionRequest,
  template: string,
  index: number,
) {
  return template
    .replace(/\{topic\}/g, request.topic)
    .replace(/\{goal\}/g, request.goal)
    .replace(/\{audience\}/g, request.audience)
    .replace(/\{index\}/g, String(index + 1));
}

const QUESTION_BANK = {
  clarity: [
    "Explain {topic} to {audience} in a way that makes the core point impossible to miss.",
    "Give a concise answer about {topic} that proves your {goal} without leaning on jargon.",
    "Describe the most misunderstood part of {topic} and correct it clearly for {audience}.",
    "Open a response on {topic} with your conclusion first, then defend it with one clean example.",
    "Summarize {topic} in under a minute so {audience} immediately understands why it matters.",
    "Answer a skeptical follow-up on {topic} while keeping the structure crisp and direct.",
  ],
  exploratory: [
    "Tell a story from your experience that reveals why {topic} matters to {audience}.",
    "Make a surprising argument about {topic} that still feels grounded and credible.",
    "Connect {topic} to a real-world moment that would help {audience} remember your point.",
    "Describe a tension or tradeoff inside {topic} and explain how you navigate it.",
    "Take {topic} from abstract to personal without losing authority or clarity.",
    "Frame {topic} as a conversation starter that invites curiosity from {audience}.",
  ],
  "pressure-test": [
    "Defend {topic} under pressure when {audience} doubts your judgment or evidence.",
    "Answer a sharp objection to {topic} while keeping your tone calm and decisive.",
    "Respond to a high-stakes question about {topic} when you only have one minute to land it.",
    "Handle pushback from {audience} on {topic} without overexplaining or retreating.",
    "Make the strongest case for {topic} when the room is skeptical and impatient.",
    "Recover smoothly after a challenging interruption while speaking about {topic}.",
  ],
} as const;

function rotateTemplates(
  request: CustomPracticeQuestionRequest,
  templates: readonly string[],
) {
  const seed = `${request.topic}|${request.goal}|${request.audience}`;
  const offset =
    seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0) %
    templates.length;

  return [...templates.slice(offset), ...templates.slice(0, offset)];
}

export function buildDeterministicCustomPracticeQuestions(
  request: CustomPracticeQuestionRequest,
): CustomPracticeQuestionResponse {
  const templates = rotateTemplates(request, QUESTION_BANK[request.intensity]);
  const questions = Array.from({ length: request.questionCount }, (_, index) => ({
    id: `cp-${index + 1}`,
    text: toQuestionText(request, templates[index % templates.length], index),
  }));

  return {
    intro: `A ${request.intensity.replace("-", " ")} custom drill for ${request.topic} with ${request.audience} in mind.`,
    model: null,
    questions,
    source: "mock",
  };
}
