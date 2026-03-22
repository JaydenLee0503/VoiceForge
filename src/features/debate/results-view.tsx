import { ArrowRight, LoaderCircle, RotateCcw, Trophy } from "lucide-react";

import { getPresenceAvailabilityMessage } from "@/lib/scoring/nonVerbalScore";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";
import type { PresenceSessionResult } from "@/types/presence";
import type {
  DebateResult,
  DebateSettings,
  FeedbackSummary,
} from "../../../lib/voice-feedback/contracts";

import { getDebateOutcomeLabel, getDebateStanceLabel } from "./config";

type DebateResultsViewProps = {
  analysisRecordingStatus: "idle" | "loading" | "missing" | "ready";
  analysisRecordingUrl: string | null;
  debateResult: DebateResult;
  feedback: FeedbackSummary;
  feedbackStatus: "idle" | "loading" | "ready";
  hasSessionRecording: boolean;
  presenceAnalysisStatus: "analyzing" | "complete" | "idle";
  presenceResult: PresenceSessionResult | null;
  settings: DebateSettings;
};

function getOutcomeTone(outcome: DebateResult["outcome"]) {
  if (outcome === "win") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  }

  if (outcome === "lose") {
    return "border-danger/30 bg-danger/10 text-danger";
  }

  return "border-primary/25 bg-primary/10 text-primary";
}

function getVerdictTitle(result: DebateResult) {
  if (result.outcome === "win") {
    return "Debate won";
  }

  if (result.outcome === "lose") {
    return "Debate lost";
  }

  return "Debate drawn";
}

export function DebateResultsView({
  analysisRecordingStatus,
  analysisRecordingUrl,
  debateResult,
  feedback,
  feedbackStatus,
  hasSessionRecording,
  presenceAnalysisStatus,
  presenceResult,
  settings,
}: DebateResultsViewProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageIntro
        description={debateResult.finalVerdict}
        eyebrow="Debate Results"
        title={getVerdictTitle(debateResult)}
        actions={
          <>
            <Button size="lg" to="/debate" variant="secondary">
              <RotateCcw className="h-4 w-4" />
              Run it back
            </Button>
            <Button size="lg" to="/dashboard">
              Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Verdict",
            value: getDebateOutcomeLabel(debateResult.outcome),
          },
          {
            label: "Total score",
            value: `${debateResult.totalScore}`,
          },
          {
            label: "Reward points",
            value: `${debateResult.rewards.points}`,
          },
          {
            label: "Badge",
            value: debateResult.rewards.badge ?? "No badge",
          },
        ].map((card) => (
          <Panel key={card.label} className="p-5" elevated>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {card.label}
              </p>
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-4 text-3xl font-semibold">{card.value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Panel className="p-6" elevated>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Match
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{settings.topic}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  You argued {getDebateStanceLabel(settings.userStance)} against an AI opponent arguing {getDebateStanceLabel(settings.opponentStance)}.
                </p>
              </div>
              <div className={`rounded-full border px-4 py-2 text-sm ${getOutcomeTone(debateResult.outcome)}`}>
                {getDebateOutcomeLabel(debateResult.outcome)}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {debateResult.roundScores.map((round) => (
                <div
                  key={round.roundId}
                  className="rounded-2xl border border-border bg-shell px-4 py-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    {round.label}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xl font-semibold">{round.score}</p>
                    <span className={`rounded-full border px-3 py-1 text-xs ${getOutcomeTone(round.outcome)}`}>
                      {getDebateOutcomeLabel(round.outcome)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {round.summary}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-6" elevated>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Category scores
            </p>
            <h2 className="mt-2 text-2xl font-semibold">How the judge saw the rep</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Clarity", debateResult.categoryScores.clarity],
                ["Confidence", debateResult.categoryScores.confidence],
                ["Argument strength", debateResult.categoryScores.argumentStrength],
                ["Rebuttal quality", debateResult.categoryScores.rebuttalQuality],
                ["Structure", debateResult.categoryScores.structure],
                ["Pace", debateResult.categoryScores.pace],
                ["Presence", debateResult.categoryScores.presence],
                ["Persuasiveness", debateResult.categoryScores.persuasiveness],
              ].map(([label, value]) => (
                <div key={label} className="space-y-3 rounded-2xl border border-border bg-shell px-4 py-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span>{label}</span>
                    <span className="font-medium">{value}%</span>
                  </div>
                  <ProgressBar value={Number(value)} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-6" elevated>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Replay notes
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Best move and next fix</h2>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {[
                {
                  body: debateResult.bestMove,
                  title: "Best move",
                },
                {
                  body: debateResult.biggestWeakness,
                  title: "Biggest weakness",
                },
                {
                  body: debateResult.nextRoundFocus,
                  title: "Next round focus",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border bg-shell px-4 py-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel className="p-6" elevated>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Judge layer
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Final verdict</h2>
              </div>
              {(presenceAnalysisStatus === "analyzing" && hasSessionRecording) ||
              feedbackStatus === "loading" ? (
                <div className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary">
                  {presenceAnalysisStatus === "analyzing" ? "Analyzing presence" : "Refreshing verdict"}
                </div>
              ) : (
                <div className={`rounded-full border px-4 py-2 text-sm ${getOutcomeTone(debateResult.outcome)}`}>
                  {debateResult.judgeSummary.source === "groq" ? "Judge synced" : "Deterministic judge"}
                </div>
              )}
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {debateResult.judgeSummary.finalVerdict}
            </p>

            <div className="mt-6 space-y-4">
              {[
                {
                  body: debateResult.judgeSummary.strongestArgument,
                  title: "Strongest argument",
                },
                {
                  body: debateResult.judgeSummary.weakestArgument,
                  title: "Weakest argument",
                },
                {
                  body: debateResult.judgeSummary.rebuttalQuality,
                  title: "Rebuttal quality",
                },
                {
                  body: debateResult.judgeSummary.suggestedImprovement,
                  title: "Suggested improvement",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border bg-shell px-4 py-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-6" elevated>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Presence
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {presenceResult?.status === "ready" && presenceResult.nonVerbalScore !== null
                    ? `${presenceResult.nonVerbalScore}% presence score`
                    : "Presence summary"}
                </h2>
              </div>
              {presenceAnalysisStatus === "analyzing" && (
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-shell p-3">
              {analysisRecordingUrl ? (
                <video
                  className="aspect-video w-full rounded-2xl bg-black object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  src={analysisRecordingUrl}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border bg-panel px-6 text-center text-sm text-muted-foreground">
                  {analysisRecordingStatus === "loading"
                    ? "Loading the recorded debate..."
                    : "Debate video unavailable."}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {presenceResult?.status === "ready" ? (
                [
                  ["Face presence", presenceResult.summary.facePresencePct],
                  ["Forward attention", presenceResult.summary.forwardAttentionPct],
                  ["Head stability", presenceResult.summary.headStabilityPct],
                  ["Speaking mouth activity", presenceResult.summary.speakingMouthActivityPct],
                ].map(([label, value]) => (
                  <div key={label} className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>{label}</span>
                      <span className="font-medium">{value}%</span>
                    </div>
                    <ProgressBar value={Number(value)} />
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-shell px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    {presenceAnalysisStatus === "analyzing" && hasSessionRecording
                      ? "MediaPipe is still analyzing the saved debate recording."
                      : getPresenceAvailabilityMessage(presenceResult?.reason)}
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-6" elevated>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Transcript evidence
            </p>
            <h2 className="mt-2 text-2xl font-semibold">What stood out</h2>

            <div className="mt-6 space-y-4">
              {feedback.highlights.map((highlight) => (
                <div
                  key={`${highlight.label}-${highlight.timestamp}`}
                  className="rounded-2xl border border-border bg-shell p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium">{highlight.label}</p>
                    <span className="font-mono text-sm text-muted-foreground">
                      {highlight.timestamp}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {highlight.quote}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
