import {
  Activity,
  Briefcase,
  HeartHandshake,
  type LucideIcon,
  MessageSquareMore,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";

export type ScenarioCategory = "all" | "everyday" | "high-stakes" | "identity";

export type Scenario = {
  id: string;
  title: string;
  description: string;
  category: Exclude<ScenarioCategory, "all">;
  difficulty: "Foundation" | "Core" | "Advanced";
  duration: string;
  icon: LucideIcon;
  focus: string;
};

export type SessionRecord = {
  id: string;
  scenarioId: string;
  scenario: string;
  date: string;
  duration: string;
  confidence: number;
  clarity: number;
};

export const navigationItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Debate Mode", href: "/debate" },
  { label: "Scenarios", href: "/scenarios" },
  { label: "Custom Practice", href: "/practice/custom" },
  { label: "History", href: "/history" },
] as const;

export const scenarioCategories: { label: string; value: ScenarioCategory }[] = [
  { label: "All", value: "all" },
  { label: "Everyday Confidence", value: "everyday" },
  { label: "High-Stakes Speaking", value: "high-stakes" },
  { label: "Expression & Identity", value: "identity" },
];

export const scenarios: Scenario[] = [
  {
    id: "pitch-coach",
    title: "Pitch Coach",
    description:
      "Sharpen your opening, structure, and conviction for founder updates or investor rooms.",
    category: "high-stakes",
    difficulty: "Core",
    duration: "15 min",
    focus: "Story arc and pacing",
    icon: Sparkles,
  },
  {
    id: "interview-practice",
    title: "Interview Practice",
    description:
      "Rehearse concise, high-signal responses without sounding rehearsed.",
    category: "high-stakes",
    difficulty: "Advanced",
    duration: "20 min",
    focus: "Precision under pressure",
    icon: Briefcase,
  },
  {
    id: "small-talk",
    title: "Small Talk",
    description:
      "Build rapport quickly and keep conversations natural instead of transactional.",
    category: "everyday",
    difficulty: "Foundation",
    duration: "10 min",
    focus: "Warmth and timing",
    icon: MessageSquareMore,
  },
  {
    id: "asking-for-help",
    title: "Asking for Help",
    description:
      "Practice direct, confident requests without overexplaining or apologizing.",
    category: "everyday",
    difficulty: "Foundation",
    duration: "8 min",
    focus: "Clarity and tone",
    icon: HeartHandshake,
  },
  {
    id: "defending-an-idea",
    title: "Defending an Idea",
    description:
      "Handle pushback with composure while keeping your reasoning intact.",
    category: "identity",
    difficulty: "Advanced",
    duration: "16 min",
    focus: "Composure and rebuttal",
    icon: Target,
  },
  {
    id: "telling-your-story",
    title: "Telling Your Story",
    description:
      "Refine your personal narrative into something memorable, grounded, and honest.",
    category: "identity",
    difficulty: "Core",
    duration: "18 min",
    focus: "Authenticity and presence",
    icon: WandSparkles,
  },
];

export const dashboardStats = [
  { label: "Sessions", value: "12", detail: "completed" },
  { label: "Streak", value: "4 days", detail: "current cadence" },
  { label: "Confidence", value: "82%", detail: "rolling average" },
  { label: "Clarity", value: "78%", detail: "rolling average" },
];

export const recentSessions: SessionRecord[] = [
  {
    id: "vf-1024",
    scenarioId: "pitch-coach",
    scenario: "Pitch Coach",
    date: "March 18, 2026",
    duration: "12m 30s",
    confidence: 85,
    clarity: 80,
  },
  {
    id: "vf-1018",
    scenarioId: "interview-practice",
    scenario: "Interview Practice",
    date: "March 16, 2026",
    duration: "18m 05s",
    confidence: 78,
    clarity: 75,
  },
  {
    id: "vf-1013",
    scenarioId: "small-talk",
    scenario: "Small Talk",
    date: "March 14, 2026",
    duration: "9m 12s",
    confidence: 90,
    clarity: 87,
  },
  {
    id: "vf-1004",
    scenarioId: "defending-an-idea",
    scenario: "Defending an Idea",
    date: "March 10, 2026",
    duration: "15m 20s",
    confidence: 72,
    clarity: 68,
  },
];

export const weeklyPerformance = [52, 67, 61, 78, 74, 82, 69];

export const landingBenefits = [
  {
    title: "Real-time AI coaching",
    description:
      "Hear what needs work while you are still in the moment, not after the energy is gone.",
  },
  {
    title: "Confidence tracking",
    description:
      "Watch clarity, conviction, and pacing become measurable habits instead of guesses.",
  },
  {
    title: "Scenario-based rehearsal",
    description:
      "Practice the conversations that matter: interviews, pitches, objections, and introductions.",
  },
];

export const liveTranscriptSeed = [
  {
    role: "coach" as const,
    text: "Welcome back. Today's focus is concise authority. Open with the problem, then your point of view.",
  },
  {
    role: "user" as const,
    text: "VoiceForge helps people sound more confident by giving them a place to rehearse high-stakes conversations.",
  },
  {
    role: "coach" as const,
    text: "Strong start. Slow the final clause slightly so the value lands cleanly.",
  },
  {
    role: "user" as const,
    text: "Instead of generic feedback, the product coaches clarity, pacing, and confidence while you speak.",
  },
];

export const resultsScores = [
  { label: "Clarity", value: 85 },
  { label: "Confidence", value: 78 },
  { label: "Pace", value: 92 },
  { label: "Presence", value: 65 },
];

export const resultsInsights = [
  {
    title: "Best moment",
    body: "Your opening statement was direct and easy to follow. The listener always knew what mattered next.",
  },
  {
    title: "Improvement area",
    body: "Your filler words climbed during transitions between technical points. A short pause would read as control.",
  },
  {
    title: "Next challenge",
    body: "Run Defending an Idea next. It is the right scenario for holding confidence under pushback.",
  },
];

export const transcriptHighlights = [
  {
    timestamp: "00:45",
    label: "High engagement",
    quote: "The product gives you a place to rehearse the conversations that decide real outcomes.",
  },
  {
    timestamp: "01:20",
    label: "Filler word cluster",
    quote: "So, um, the main advantage is that the coaching happens while you're still speaking.",
  },
];

export const practiceQuestions = [
  "Describe a time you had to explain a complex idea to a skeptical audience.",
  "What is the clearest signal that someone trusts your communication?",
  "How would you introduce your work in one minute to a room full of strangers?",
  "Tell the story of a recent setback without losing authority.",
  "What idea do you believe in strongly enough to defend under pressure?",
  "How do you balance confidence with humility when presenting your work?",
  "Describe a conversation you wish you had handled with more clarity.",
  "What makes someone sound credible before they finish their first sentence?",
];

export const focusAreas = [
  {
    title: "Today's focus",
    detail: "Clarity and enunciation",
    body: "Reduce filler words during transitions and let key phrases breathe.",
  },
  {
    title: "Mission control",
    detail: "Weekly rhythm",
    body: "Three short sessions this week will do more than one long catch-up session.",
  },
];

export const liveMetrics = [
  { label: "Clarity", value: 82, tone: "cyan" },
  { label: "Confidence", value: 78, tone: "emerald" },
  { label: "Pace", value: 70, tone: "violet" },
];

export const historySummary = [
  { label: "Completed", value: "24" },
  { label: "Avg. Confidence", value: "81%" },
  { label: "Avg. Duration", value: "14 min" },
];

export const performanceSignals = [
  { icon: Activity, label: "Live signal", value: "Stable" },
  { icon: Target, label: "Primary aim", value: "Command presence" },
];
