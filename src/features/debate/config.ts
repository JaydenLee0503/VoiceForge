import type {
  DebateAudienceStyle,
  DebateDifficulty,
  DebateJudgeStyle,
  DebateOutcome,
  DebateRoundFormat,
  DebateRoundPlan,
  DebateSettings,
  DebateStance,
  SessionAnalysisScenario,
} from "../../../lib/voice-feedback/contracts";

const STORAGE_KEY = "voiceforge-debate-mode";
const MIN_PREP_SECONDS = 15;
const MAX_PREP_SECONDS = 60;

export type DebateTopicOption = {
  cue: string;
  id: string;
  title: string;
};

export const debateTopics: DebateTopicOption[] = [
  {
    cue: "Argue whether AI should absorb routine assignments and shift schools toward oral defense, projects, and reasoning.",
    id: "ai-homework",
    title: "AI should replace most school homework",
  },
  {
    cue: "Debate whether social platforms create more social upside or harm for teenagers over time.",
    id: "social-media-teens",
    title: "Social media helps more than harms teens",
  },
  {
    cue: "Argue whether startup speed should outrank ethical caution during the first years of a company.",
    id: "speed-vs-ethics",
    title: "Startups should prioritize speed over ethics",
  },
  {
    cue: "Argue whether universities are losing their status as the default path for ambitious builders.",
    id: "universities-necessary",
    title: "Universities are becoming less necessary",
  },
];

export const debateDifficultyOptions: Array<{ label: string; value: DebateDifficulty }> = [
  { label: "Foundation", value: "foundation" },
  { label: "Challenger", value: "challenger" },
  { label: "Apex", value: "apex" },
];

export const debateLengthOptions: Array<{
  label: string;
  value: DebateSettings["lengthMinutes"];
}> = [
  { label: "1 min", value: 1 },
  { label: "2 min", value: 2 },
  { label: "3 min", value: 3 },
  { label: "4 min", value: 4 },
];

export const debateRoundFormatOptions: Array<{
  label: string;
  value: DebateRoundFormat;
}> = [
  { label: "Balanced", value: "balanced" },
  { label: "Rapid Fire", value: "rapid-fire" },
  { label: "Rebuttal Heavy", value: "rebuttal-heavy" },
];

export const debateAudienceOptions: Array<{
  label: string;
  value: DebateAudienceStyle;
}> = [
  { label: "Boardroom", value: "boardroom" },
  { label: "Campus Forum", value: "campus-forum" },
  { label: "Public Square", value: "public-square" },
];

export const debateJudgeOptions: Array<{ label: string; value: DebateJudgeStyle }> = [
  { label: "Balanced", value: "balanced" },
  { label: "Analytical", value: "analytical" },
  { label: "Skeptical", value: "skeptical" },
];

export const debateStanceOptions: Array<{ label: string; value: DebateStance }> = [
  { label: "Affirm", value: "affirm" },
  { label: "Oppose", value: "oppose" },
];

export const DEFAULT_DEBATE_SETTINGS: DebateSettings = {
  assignedStance: false,
  audienceStyle: "boardroom",
  difficulty: "challenger",
  judgeStyle: "balanced",
  lengthMinutes: 2,
  opponentStance: "oppose",
  prepSeconds: 30,
  roundFormat: "balanced",
  roundPlan: buildDebateRoundPlan(2, "balanced"),
  topic: debateTopics[0].title,
  topicId: debateTopics[0].id,
  userStance: "affirm",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLengthMinutes(value: unknown): DebateSettings["lengthMinutes"] {
  return value === 1 || value === 2 || value === 3 || value === 4
    ? value
    : DEFAULT_DEBATE_SETTINGS.lengthMinutes;
}

function normalizeRoundFormat(value: unknown): DebateRoundFormat {
  return value === "balanced" || value === "rapid-fire" || value === "rebuttal-heavy"
    ? value
    : DEFAULT_DEBATE_SETTINGS.roundFormat;
}

function normalizeDifficulty(value: unknown): DebateDifficulty {
  return value === "foundation" || value === "challenger" || value === "apex"
    ? value
    : DEFAULT_DEBATE_SETTINGS.difficulty;
}

function normalizeAudienceStyle(value: unknown): DebateAudienceStyle {
  return value === "boardroom" || value === "campus-forum" || value === "public-square"
    ? value
    : DEFAULT_DEBATE_SETTINGS.audienceStyle;
}

function normalizeJudgeStyle(value: unknown): DebateJudgeStyle {
  return value === "balanced" || value === "analytical" || value === "skeptical"
    ? value
    : DEFAULT_DEBATE_SETTINGS.judgeStyle;
}

function normalizeStance(value: unknown): DebateStance {
  return value === "affirm" || value === "oppose" ? value : DEFAULT_DEBATE_SETTINGS.userStance;
}

function createRoundPlan(
  lengthMinutes: DebateSettings["lengthMinutes"],
  roundFormat: DebateRoundFormat,
): DebateRoundPlan[] {
  const totalSeconds = lengthMinutes * 60;
  const ratios =
    roundFormat === "rapid-fire"
      ? [0.24, 0.52, 0.24]
      : roundFormat === "rebuttal-heavy"
        ? [0.2, 0.58, 0.22]
        : [0.28, 0.46, 0.26];
  const openingSeconds = Math.max(15, Math.round(totalSeconds * ratios[0] / 5) * 5);
  const closingSeconds = Math.max(15, Math.round(totalSeconds * ratios[2] / 5) * 5);
  const rebuttalSeconds = Math.max(20, totalSeconds - openingSeconds - closingSeconds);

  return [
    {
      id: "opening",
      label: "Opening statement",
      order: 0,
      prompt: "Start with your strongest claim and the first reason it should hold.",
      seconds: openingSeconds,
      type: "opening",
    },
    {
      id: "rebuttal",
      label: "Rebuttal exchange",
      order: 1,
      prompt: "Attack the weak point in the opponent's logic and rebuild your own case quickly.",
      seconds: rebuttalSeconds,
      type: "rebuttal",
    },
    {
      id: "closing",
      label: "Closing statement",
      order: 2,
      prompt: "Condense the case, restate the edge, and make the final decision easy for the judge.",
      seconds: closingSeconds,
      type: "closing",
    },
  ];
}

export function buildDebateRoundPlan(
  lengthMinutes: DebateSettings["lengthMinutes"],
  roundFormat: DebateRoundFormat,
) {
  return createRoundPlan(lengthMinutes, roundFormat);
}

export function normalizeDebateSettings(
  settings?: Partial<DebateSettings> | null,
): DebateSettings {
  const lengthMinutes = normalizeLengthMinutes(settings?.lengthMinutes);
  const roundFormat = normalizeRoundFormat(settings?.roundFormat);
  const topic = settings?.topic?.trim() || DEFAULT_DEBATE_SETTINGS.topic;
  const topicId = settings?.topicId ?? debateTopics.find((option) => option.title === topic)?.id ?? null;
  const userStance = normalizeStance(settings?.userStance);
  const assignedStance = settings?.assignedStance ?? DEFAULT_DEBATE_SETTINGS.assignedStance;
  const opponentStance = userStance === "affirm" ? "oppose" : "affirm";

  return {
    assignedStance,
    audienceStyle: normalizeAudienceStyle(settings?.audienceStyle),
    difficulty: normalizeDifficulty(settings?.difficulty),
    judgeStyle: normalizeJudgeStyle(settings?.judgeStyle),
    lengthMinutes,
    opponentStance,
    prepSeconds: clamp(
      settings?.prepSeconds ?? DEFAULT_DEBATE_SETTINGS.prepSeconds,
      MIN_PREP_SECONDS,
      MAX_PREP_SECONDS,
    ),
    roundFormat,
    roundPlan: createRoundPlan(lengthMinutes, roundFormat),
    topic,
    topicId,
    userStance,
  };
}

export function finalizeDebateSettings(settings: DebateSettings) {
  if (!settings.assignedStance) {
    return normalizeDebateSettings(settings);
  }

  const userStance = Math.random() > 0.5 ? "affirm" : "oppose";

  return normalizeDebateSettings({
    ...settings,
    assignedStance: true,
    userStance,
  });
}

export function loadDebateSettings() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue);

    if (!isRecord(parsedValue)) {
      return null;
    }

    return normalizeDebateSettings(parsedValue as Partial<DebateSettings>);
  } catch {
    return null;
  }
}

export function saveDebateSettings(settings: DebateSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDebateSettings(settings)));
}

export function buildDebateScenario(settings: DebateSettings): SessionAnalysisScenario {
  const shortTopic =
    settings.topic.length > 46 ? `${settings.topic.slice(0, 43).trim()}...` : settings.topic;

  return {
    description: `${settings.lengthMinutes}-minute ${getDebateRoundFormatLabel(settings.roundFormat).toLowerCase()} debate on "${settings.topic}".`,
    focus: "argument pressure and rebuttal control",
    id: "debate-mode",
    title: `Debate Arena: ${shortTopic}`,
  };
}

export function getDebateTopicCue(topic: string, topicId: string | null) {
  return debateTopics.find((option) => option.id === topicId)?.cue ?? topic;
}

export function getDebateStanceLabel(stance: DebateStance) {
  return stance === "affirm" ? "Affirm" : "Oppose";
}

export function getDebateDifficultyLabel(difficulty: DebateDifficulty) {
  return debateDifficultyOptions.find((option) => option.value === difficulty)?.label ?? "Challenger";
}

export function getDebateDifficultyProfile(difficulty: DebateDifficulty) {
  if (difficulty === "foundation") {
    return {
      aggressiveness: "measured pressure",
      complexity: "clean, readable arguments",
      rebuttalSharpness: "moderate counters",
      speed: "steady tempo",
    };
  }

  if (difficulty === "apex") {
    return {
      aggressiveness: "high pressure",
      complexity: "dense reasoning",
      rebuttalSharpness: "sharp counters",
      speed: "fast tempo",
    };
  }

  return {
    aggressiveness: "firm pressure",
    complexity: "layered reasoning",
    rebuttalSharpness: "direct counters",
    speed: "controlled pace",
  };
}

export function getDebateAudienceLabel(style: DebateAudienceStyle) {
  return debateAudienceOptions.find((option) => option.value === style)?.label ?? "Boardroom";
}

export function getDebateJudgeLabel(style: DebateJudgeStyle) {
  return debateJudgeOptions.find((option) => option.value === style)?.label ?? "Balanced";
}

export function getDebateRoundFormatLabel(roundFormat: DebateRoundFormat) {
  return debateRoundFormatOptions.find((option) => option.value === roundFormat)?.label ?? "Balanced";
}

export function getDebateOutcomeLabel(outcome: DebateOutcome) {
  if (outcome === "win") {
    return "Win";
  }

  if (outcome === "lose") {
    return "Loss";
  }

  return "Draw";
}
