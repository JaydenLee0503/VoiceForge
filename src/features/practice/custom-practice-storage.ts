import type {
  CustomPracticeSettings,
  SessionAnalysisScenario,
} from "../../../lib/voice-feedback/contracts";

const STORAGE_KEY = "voiceforge-custom-practice";
const MIN_ANSWER_TIME = 30;
const MAX_ANSWER_TIME = 240;
const MIN_PREP_TIME = 15;
const MAX_PREP_TIME = 180;
export const MIN_CUSTOM_PRACTICE_QUESTION_COUNT = 1;
export const MAX_CUSTOM_PRACTICE_QUESTION_COUNT = 5;

export const DEFAULT_CUSTOM_PRACTICE_SETTINGS: CustomPracticeSettings = {
  answerTime: 120,
  audience: "someone hearing you for the first time",
  goal: "sound clear and confident",
  intensity: "clarity",
  prepTime: 60,
  questionCount: 5,
  topic: "your work, an idea you care about, or a recent experience",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCustomPracticeSettings(
  settings?: Partial<CustomPracticeSettings> | null,
) {
  return {
    ...DEFAULT_CUSTOM_PRACTICE_SETTINGS,
    answerTime: clamp(
      settings?.answerTime ?? DEFAULT_CUSTOM_PRACTICE_SETTINGS.answerTime,
      MIN_ANSWER_TIME,
      MAX_ANSWER_TIME,
    ),
    prepTime: clamp(
      settings?.prepTime ?? DEFAULT_CUSTOM_PRACTICE_SETTINGS.prepTime,
      MIN_PREP_TIME,
      MAX_PREP_TIME,
    ),
    questionCount: clamp(
      settings?.questionCount ?? DEFAULT_CUSTOM_PRACTICE_SETTINGS.questionCount,
      MIN_CUSTOM_PRACTICE_QUESTION_COUNT,
      MAX_CUSTOM_PRACTICE_QUESTION_COUNT,
    ),
  } satisfies CustomPracticeSettings;
}

export function loadCustomPracticeSettings() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (!isRecord(parsed)) {
      return null;
    }

    if (
      typeof parsed.answerTime !== "number" ||
      typeof parsed.prepTime !== "number" ||
      typeof parsed.questionCount !== "number"
    ) {
      return null;
    }

    return normalizeCustomPracticeSettings({
      answerTime: parsed.answerTime,
      prepTime: parsed.prepTime,
      questionCount: parsed.questionCount,
    });
  } catch {
    return null;
  }
}

export function saveCustomPracticeSettings(settings: CustomPracticeSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function buildCustomPracticeScenario(
  settings: CustomPracticeSettings,
): SessionAnalysisScenario {
  const totalSeconds =
    settings.questionCount * (settings.prepTime + settings.answerTime);

  return {
    description: `${settings.questionCount} timed questions over roughly ${Math.round(totalSeconds / 60)} minutes.`,
    focus: "timed speaking practice",
    id: "custom-practice",
    title: "Custom Practice",
  };
}
