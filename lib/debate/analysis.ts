import {
  buildDeterministicFeedbackSummary,
  buildVerbalMetricsSummary,
} from "../voice-feedback/analysis";
import type {
  DebateCategoryScores,
  DebateJudgeSummary,
  DebateJudgeWinner,
  DebateOutcome,
  DebateResult,
  DebateRoundPlan,
  SessionAnalysisPayload,
  SessionTranscriptEntry,
  VerbalMetricsSummary,
} from "../voice-feedback/contracts";

const ARGUMENT_PATTERNS = [
  /\bbecause\b/gi,
  /\btherefore\b/gi,
  /\bso\b/gi,
  /\bmeans\b/gi,
  /\bif\b/gi,
  /\bthen\b/gi,
  /\bshows?\b/gi,
  /\bevidence\b/gi,
  /\bdata\b/gi,
  /\bresults?\b/gi,
  /\bstudy\b/gi,
  /\bresearch\b/gi,
  /\bproves?\b/gi,
] as const;

const EXAMPLE_PATTERNS = [
  /\bfor example\b/gi,
  /\bfor instance\b/gi,
  /\bconsider\b/gi,
  /\bimagine\b/gi,
  /\bin practice\b/gi,
] as const;

const REBUTTAL_PATTERNS = [
  /\bhowever\b/gi,
  /\bbut\b/gi,
  /\byet\b/gi,
  /\bstill\b/gi,
  /\beven if\b/gi,
  /\bthat misses\b/gi,
  /\bthat ignores\b/gi,
  /\bthat overlooks\b/gi,
  /\bthat confuses\b/gi,
  /\bthe flaw\b/gi,
  /\bthe gap\b/gi,
  /\bthe weak point\b/gi,
  /\byour point\b/gi,
  /\byour claim\b/gi,
  /\bthat claim\b/gi,
  /\bthat argument\b/gi,
  /\byou assume\b/gi,
  /\byou ignore\b/gi,
  /\byou overlook\b/gi,
  /\bopponent\b/gi,
] as const;

const STRUCTURE_PATTERNS = [
  /\bfirst\b/gi,
  /\bsecond\b/gi,
  /\bthird\b/gi,
  /\bfinally\b/gi,
  /\boverall\b/gi,
  /\bbottom line\b/gi,
  /\bthe point is\b/gi,
  /\bto start\b/gi,
  /\bin short\b/gi,
  /\bin sum\b/gi,
] as const;

const PERSUASION_PATTERNS = [
  /\bshould\b/gi,
  /\bmust\b/gi,
  /\bmatters?\b/gi,
  /\bnecessary\b/gi,
  /\bbetter\b/gi,
  /\bstronger\b/gi,
  /\bmore likely\b/gi,
  /\bworth\b/gi,
  /\bcredibl(e|ity)\b/gi,
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value, 40, 98));
}

function countPattern(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function countPatterns(text: string, patterns: readonly RegExp[]) {
  return patterns.reduce((total, pattern) => total + countPattern(text, pattern), 0);
}

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getUserEntries(payload: SessionAnalysisPayload) {
  return payload.transcript.filter(
    (entry) => entry.role === "user" && entry.text.trim().length > 0,
  );
}

function getOpponentEntries(payload: SessionAnalysisPayload) {
  return payload.transcript.filter(
    (entry) => entry.role !== "user" && entry.text.trim().length > 0,
  );
}

function getUserText(entries: SessionTranscriptEntry[]) {
  return entries.map((entry) => entry.text).join(" ");
}

function getSessionDurationSeconds(payload: SessionAnalysisPayload) {
  if (payload.durationSeconds > 0) {
    return payload.durationSeconds;
  }

  const firstTimestamp = payload.transcript[0]?.timestamp ?? 0;
  const lastTimestamp = payload.transcript[payload.transcript.length - 1]?.timestamp ?? 0;

  if (lastTimestamp > firstTimestamp) {
    return Math.round((lastTimestamp - firstTimestamp) / 1000);
  }

  return 0;
}

function getDifficultyBaseline(payload: SessionAnalysisPayload) {
  const difficulty = payload.debateSettings?.difficulty ?? "challenger";

  if (difficulty === "foundation") {
    return 66;
  }

  if (difficulty === "apex") {
    return 79;
  }

  return 72;
}

function formatMetricLabel(metric: keyof DebateCategoryScores) {
  switch (metric) {
    case "argumentStrength":
      return "argument strength";
    case "rebuttalQuality":
      return "rebuttal quality";
    default:
      return metric;
  }
}

function getStrongestMetric(scores: DebateCategoryScores) {
  return (Object.entries(scores) as Array<[keyof DebateCategoryScores, number]>).sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0] ?? "clarity";
}

function getWeakestMetric(scores: DebateCategoryScores) {
  return (Object.entries(scores) as Array<[keyof DebateCategoryScores, number]>).sort(
    (left, right) => left[1] - right[1],
  )[0]?.[0] ?? "clarity";
}

function buildCategoryScores(
  payload: SessionAnalysisPayload,
  verbalMetrics: VerbalMetricsSummary,
): DebateCategoryScores {
  const userEntries = getUserEntries(payload);
  const userText = getUserText(userEntries);
  const opponentEntries = getOpponentEntries(payload);
  const argumentSignals = countPatterns(userText, ARGUMENT_PATTERNS);
  const exampleSignals = countPatterns(userText, EXAMPLE_PATTERNS);
  const rebuttalSignals = countPatterns(userText, REBUTTAL_PATTERNS);
  const structureSignals = countPatterns(userText, STRUCTURE_PATTERNS);
  const persuasionSignals = countPatterns(userText, PERSUASION_PATTERNS);
  const longEntries = userEntries.filter((entry) => countWords(entry.text) >= 12).length;
  const presence =
    payload.presence?.nonVerbalScore ?? verbalMetrics.scores.eyeContactPresence;
  const clarity = verbalMetrics.scores.clarity;
  const confidence = verbalMetrics.scores.confidence;
  const pace = verbalMetrics.scores.pace;
  const argumentStrength = roundScore(
    57 +
      Math.min(argumentSignals * 4.2, 24) +
      Math.min(exampleSignals * 3.5, 10) +
      Math.min(verbalMetrics.totalUserWords * 0.07, 14) -
      verbalMetrics.fillerCount * 2.2 -
      verbalMetrics.hedgeCount * 1.8,
  );
  const rebuttalQuality = roundScore(
    54 +
      Math.min(rebuttalSignals * 5.8, 26) +
      Math.min(opponentEntries.length * 1.8, 10) +
      Math.min(argumentSignals * 1.6, 8) -
      verbalMetrics.hedgeCount * 2.4,
  );
  const structure = roundScore(
    59 +
      Math.min(structureSignals * 4.8, 22) +
      Math.min(longEntries * 2.6, 10) +
      Math.max(0, 18 - Math.abs(verbalMetrics.averageWordsPerUtterance - 16)) * 0.9 -
      verbalMetrics.fillerCount * 1.4,
  );
  const persuasiveness = roundScore(
    clarity * 0.2 +
      confidence * 0.2 +
      argumentStrength * 0.24 +
      rebuttalQuality * 0.16 +
      structure * 0.12 +
      presence * 0.08 +
      Math.min(persuasionSignals * 2.4, 10) -
      verbalMetrics.fillerCount * 1.3,
  );

  return {
    argumentStrength,
    clarity,
    confidence,
    pace,
    persuasiveness,
    presence,
    rebuttalQuality,
    structure,
  };
}

function getRoundOutcome(score: number, payload: SessionAnalysisPayload, round: DebateRoundPlan) {
  const baseTarget = getDifficultyBaseline(payload);
  const roundTarget =
    round.type === "rebuttal"
      ? baseTarget + 2
      : round.type === "closing"
        ? baseTarget + 1
        : baseTarget;

  if (score >= roundTarget + 2) {
    return "win" satisfies DebateOutcome;
  }

  if (score <= roundTarget - 2) {
    return "lose" satisfies DebateOutcome;
  }

  return "draw" satisfies DebateOutcome;
}

function buildRoundSummary(
  round: DebateRoundPlan,
  outcome: DebateOutcome,
  scores: DebateCategoryScores,
) {
  const strongestMetric = formatMetricLabel(getStrongestMetric(scores));
  const weakestMetric = formatMetricLabel(getWeakestMetric(scores));

  if (outcome === "win") {
    return `${round.label} held on ${strongestMetric}.`;
  }

  if (outcome === "lose") {
    return `${round.label} slipped on ${weakestMetric}.`;
  }

  return `${round.label} stayed even, but ${weakestMetric} is still the next lever.`;
}

function getRoundWindow(
  sessionStartTimestamp: number,
  roundPlan: DebateRoundPlan[],
  targetRoundId: string,
) {
  let elapsedSeconds = 0;

  for (const round of roundPlan) {
    const windowStart = sessionStartTimestamp + elapsedSeconds * 1000;
    const windowEnd = windowStart + round.seconds * 1000;

    if (round.id === targetRoundId) {
      return {
        end: windowEnd,
        start: windowStart,
      };
    }

    elapsedSeconds += round.seconds;
  }

  return {
    end: sessionStartTimestamp,
    start: sessionStartTimestamp,
  };
}

function buildRoundPayload(payload: SessionAnalysisPayload, round: DebateRoundPlan) {
  const sessionStartTimestamp = payload.transcript[0]?.timestamp ?? Date.now();
  const window = getRoundWindow(
    sessionStartTimestamp,
    payload.debateSettings?.roundPlan ?? [],
    round.id,
  );
  const roundTranscript = payload.transcript.filter(
    (entry) => entry.timestamp >= window.start && entry.timestamp < window.end,
  );

  return {
    ...payload,
    durationSeconds: Math.max(round.seconds, 1),
    transcript: roundTranscript,
  } satisfies SessionAnalysisPayload;
}

function buildRoundScores(
  payload: SessionAnalysisPayload,
  categoryScores: DebateCategoryScores,
): DebateResult["roundScores"] {
  const roundPlan = payload.debateSettings?.roundPlan ?? [];

  if (roundPlan.length === 0) {
    return [] satisfies DebateResult["roundScores"];
  }

  return roundPlan.map((round) => {
    const roundPayload = buildRoundPayload(payload, round);
    const hasUserSpeech = roundPayload.transcript.some((entry) => entry.role === "user");
    const roundVerbalMetrics = hasUserSpeech
      ? buildVerbalMetricsSummary(roundPayload)
      : {
          averageWordsPerUtterance: 0,
          fillerCount: 0,
          fillerWordBreakdown: {},
          hedgeCount: 0,
          questionCount: 0,
          scores: {
            clarity: categoryScores.clarity,
            confidence: categoryScores.confidence,
            eyeContactPresence: categoryScores.presence,
            fillerWords: 80,
            pace: categoryScores.pace,
          },
          totalUserWords: 0,
          wordsPerMinute: 0,
        } satisfies VerbalMetricsSummary;
    const roundCategoryScores = hasUserSpeech
      ? buildCategoryScores(roundPayload, roundVerbalMetrics)
      : categoryScores;
    const score = roundScore(
      round.type === "opening"
        ? roundCategoryScores.clarity * 0.24 +
            roundCategoryScores.confidence * 0.2 +
            roundCategoryScores.argumentStrength * 0.2 +
            roundCategoryScores.structure * 0.2 +
            roundCategoryScores.pace * 0.1 +
            roundCategoryScores.presence * 0.06
        : round.type === "rebuttal"
          ? roundCategoryScores.argumentStrength * 0.28 +
              roundCategoryScores.rebuttalQuality * 0.3 +
              roundCategoryScores.clarity * 0.12 +
              roundCategoryScores.confidence * 0.1 +
              roundCategoryScores.structure * 0.1 +
              roundCategoryScores.pace * 0.06 +
              roundCategoryScores.presence * 0.04
          : roundCategoryScores.persuasiveness * 0.28 +
              roundCategoryScores.confidence * 0.2 +
              roundCategoryScores.structure * 0.18 +
              roundCategoryScores.clarity * 0.14 +
              roundCategoryScores.argumentStrength * 0.1 +
              roundCategoryScores.pace * 0.06 +
              roundCategoryScores.presence * 0.04,
    );
    const outcome = getRoundOutcome(score, payload, round);

    return {
      label: round.label,
      outcome,
      roundId: round.id,
      score,
      summary: buildRoundSummary(round, outcome, roundCategoryScores),
    } satisfies DebateResult["roundScores"][number];
  });
}

function buildBestMove(
  strongestMetric: keyof DebateCategoryScores,
  feedbackSummary: ReturnType<typeof buildDeterministicFeedbackSummary>,
) {
  if (strongestMetric === "rebuttalQuality") {
    return "Your best move was answering pressure with direct pushback instead of repeating the claim.";
  }

  if (strongestMetric === "argumentStrength") {
    return "Your best move was grounding the case in reasoning rather than generic position-taking.";
  }

  if (strongestMetric === "structure") {
    return "Your best move was keeping the case ordered enough for the judge to track it.";
  }

  return feedbackSummary.bestMoment;
}

function buildBiggestWeakness(weakestMetric: keyof DebateCategoryScores) {
  if (weakestMetric === "rebuttalQuality") {
    return "Your rebuttals did not pressure the opponent often enough. Name the flaw faster.";
  }

  if (weakestMetric === "argumentStrength") {
    return "The case needed one more concrete reason or example to feel durable under pressure.";
  }

  if (weakestMetric === "structure") {
    return "The argument flow loosened in the middle. Signal your line of reasoning earlier.";
  }

  if (weakestMetric === "presence") {
    return "Your physical presence softened the pressure. Stay visibly settled while making the point.";
  }

  return `The clearest drag was ${formatMetricLabel(weakestMetric)}. Tighten that first.`;
}

function buildNextRoundFocus(weakestMetric: keyof DebateCategoryScores) {
  if (weakestMetric === "rebuttalQuality") {
    return "Attack the weak premise sooner and tie the reply back to the motion.";
  }

  if (weakestMetric === "argumentStrength") {
    return "Bring one cleaner example or causal link into the next round.";
  }

  if (weakestMetric === "pace") {
    return "Slow the transition after each claim so the judge can feel the control.";
  }

  if (weakestMetric === "presence") {
    return "Keep your head still and eyes forward while landing the strongest line.";
  }

  return `Protect ${formatMetricLabel(weakestMetric)} on the next rep.`;
}

function buildRewards(
  outcome: DebateOutcome,
  scores: DebateCategoryScores,
  totalScore: number,
) {
  const streakBonus = 0;
  const points = totalScore + (outcome === "win" ? 18 : outcome === "draw" ? 10 : 4);
  const badge =
    scores.rebuttalQuality >= 84
      ? "Rebuttal Edge"
      : scores.clarity >= 86
        ? "Clean Pressure"
        : scores.presence >= 82
          ? "Arena Presence"
          : outcome === "win"
            ? "Debate Win"
            : null;

  return {
    badge,
    points,
    streakBonus,
  };
}

function resolveDeterministicOutcome(totalScore: number, roundScores: DebateResult["roundScores"], payload: SessionAnalysisPayload) {
  const difficultyBaseline = getDifficultyBaseline(payload);
  const wins = roundScores.filter((round) => round.outcome === "win").length;
  const losses = roundScores.filter((round) => round.outcome === "lose").length;

  if ((wins > losses && totalScore >= difficultyBaseline - 2) || totalScore >= difficultyBaseline + 6) {
    return "win" satisfies DebateOutcome;
  }

  if ((losses > wins && totalScore <= difficultyBaseline + 1) || totalScore <= difficultyBaseline - 5) {
    return "lose" satisfies DebateOutcome;
  }

  return "draw" satisfies DebateOutcome;
}

function buildFinalVerdict(
  outcome: DebateOutcome,
  strongestMetric: keyof DebateCategoryScores,
  weakestMetric: keyof DebateCategoryScores,
) {
  if (outcome === "win") {
    return `You took the decision on ${formatMetricLabel(strongestMetric)} and overall round control.`;
  }

  if (outcome === "lose") {
    return `The opponent held the edge. ${formatMetricLabel(weakestMetric)} gave away too much ground.`;
  }

  return `The debate finished level. ${formatMetricLabel(strongestMetric)} landed, but the edge never fully separated.`;
}

function buildJudgeWinner(outcome: DebateOutcome) {
  if (outcome === "win") {
    return "user" satisfies DebateJudgeWinner;
  }

  if (outcome === "lose") {
    return "opponent" satisfies DebateJudgeWinner;
  }

  return "draw" satisfies DebateJudgeWinner;
}

function buildJudgeSummary(
  finalVerdict: string,
  outcome: DebateOutcome,
  feedbackSummary: ReturnType<typeof buildDeterministicFeedbackSummary>,
  nextRoundFocus: string,
  rebuttalQuality: number,
) {
  return {
    finalVerdict,
    model: null,
    rebuttalQuality:
      rebuttalQuality >= 82
        ? "You answered pressure directly and kept the exchange sharp."
        : rebuttalQuality >= 70
          ? "Some rebuttals landed, but the counters needed more precision."
          : "The reply often drifted back into your case instead of attacking theirs.",
    source: "deterministic",
    strongestArgument: feedbackSummary.highlights[0]?.quote ?? feedbackSummary.bestMoment,
    suggestedImprovement: nextRoundFocus,
    weakestArgument: feedbackSummary.highlights[1]?.quote ?? feedbackSummary.improvementArea,
    winner: buildJudgeWinner(outcome),
  } satisfies DebateJudgeSummary;
}

export function buildDeterministicDebateResult(payload: SessionAnalysisPayload): DebateResult {
  if (!payload.debateSettings) {
    throw new Error("Debate settings are required to score a debate session.");
  }

  const verbalMetrics = payload.verbalMetrics ?? buildVerbalMetricsSummary(payload);
  const categoryScores = buildCategoryScores(payload, verbalMetrics);
  const roundScores = buildRoundScores(payload, categoryScores);
  const totalScore = roundScore(
    categoryScores.clarity * 0.15 +
      categoryScores.confidence * 0.13 +
      categoryScores.argumentStrength * 0.19 +
      categoryScores.rebuttalQuality * 0.16 +
      categoryScores.structure * 0.12 +
      categoryScores.pace * 0.1 +
      categoryScores.presence * 0.05 +
      categoryScores.persuasiveness * 0.1,
  );
  const strongestMetric = getStrongestMetric(categoryScores);
  const weakestMetric = getWeakestMetric(categoryScores);
  const feedbackSummary = buildDeterministicFeedbackSummary(payload);
  const outcome = resolveDeterministicOutcome(totalScore, roundScores, payload);
  const finalVerdict = buildFinalVerdict(outcome, strongestMetric, weakestMetric);
  const nextRoundFocus = buildNextRoundFocus(weakestMetric);

  return {
    bestMove: buildBestMove(strongestMetric, feedbackSummary),
    biggestWeakness: buildBiggestWeakness(weakestMetric),
    categoryScores,
    finalVerdict,
    judgeSummary: buildJudgeSummary(
      finalVerdict,
      outcome,
      feedbackSummary,
      nextRoundFocus,
      categoryScores.rebuttalQuality,
    ),
    nextRoundFocus,
    outcome,
    rewards: buildRewards(outcome, categoryScores, totalScore),
    roundScores,
    totalScore,
    updatedAt: Date.now(),
  };
}

export function buildDebatePromptSnapshot(payload: SessionAnalysisPayload) {
  if (!payload.debateSettings) {
    return null;
  }

  const debateResult = buildDeterministicDebateResult(payload);
  const verbalMetrics = payload.verbalMetrics ?? buildVerbalMetricsSummary(payload);
  const transcriptExcerpt = payload.transcript
    .slice(-12)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
    .join("\n");

  return {
    audienceStyle: payload.debateSettings.audienceStyle,
    categoryScores: debateResult.categoryScores,
    difficulty: payload.debateSettings.difficulty,
    durationSeconds: getSessionDurationSeconds(payload),
    judgeStyle: payload.debateSettings.judgeStyle,
    outcome: debateResult.outcome,
    opponentStance: payload.debateSettings.opponentStance,
    prepSeconds: payload.debateSettings.prepSeconds,
    roundFormat: payload.debateSettings.roundFormat,
    roundPlan: payload.debateSettings.roundPlan.map((round) => ({
      label: round.label,
      seconds: round.seconds,
      type: round.type,
    })),
    roundScores: debateResult.roundScores,
    topic: payload.debateSettings.topic,
    totalScore: debateResult.totalScore,
    transcriptExcerpt,
    userStance: payload.debateSettings.userStance,
    verbalMetrics: {
      averageWordsPerUtterance: verbalMetrics.averageWordsPerUtterance,
      fillerCount: verbalMetrics.fillerCount,
      hedgeCount: verbalMetrics.hedgeCount,
      totalUserWords: verbalMetrics.totalUserWords,
      wordsPerMinute: verbalMetrics.wordsPerMinute,
    },
  };
}

export function mergeDebateJudgeSummary(
  baseResult: DebateResult,
  judgeSummary: DebateJudgeSummary,
): DebateResult {
  const alignedWinner =
    (baseResult.outcome === "win" && judgeSummary.winner === "user") ||
    (baseResult.outcome === "lose" && judgeSummary.winner === "opponent") ||
    (baseResult.outcome === "draw" && judgeSummary.winner === "draw");
  const nextOutcome =
    baseResult.outcome === "draw" && judgeSummary.winner !== "draw"
      ? judgeSummary.winner === "user"
        ? "win"
        : "lose"
      : baseResult.outcome;

  return {
    ...baseResult,
    finalVerdict: alignedWinner ? judgeSummary.finalVerdict : baseResult.finalVerdict,
    judgeSummary,
    outcome: nextOutcome,
    rewards: {
      ...baseResult.rewards,
      points:
        baseResult.totalScore + (nextOutcome === "win" ? 18 : nextOutcome === "draw" ? 10 : 4),
    },
    updatedAt: Date.now(),
  };
}
