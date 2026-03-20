import { ArrowRight, RotateCcw, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { buildDeterministicFeedbackSummary } from "../../../lib/voice-feedback/analysis";
import type { FeedbackSummary } from "../../../lib/voice-feedback/contracts";
import { scenarios } from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";

import { requestSessionFeedback } from "./feedback-client";
import {
  buildSessionHistoryEntry,
  createMockSessionPayload,
  loadLastSessionSnapshot,
  loadSessionHistoryEntry,
  upsertSessionHistoryEntry,
} from "./session-storage";

function getResultsTitle(feedback: FeedbackSummary) {
  const averageScore = Math.round(
    (feedback.scores.clarity +
      feedback.scores.confidence +
      feedback.scores.pace +
      feedback.scores.eyeContactPresence) /
      4,
  );

  if (averageScore >= 85) {
    return "Strong finish";
  }

  if (averageScore >= 74) {
    return "Solid session";
  }

  return "Useful rep";
}

function formatFillerBreakdown(feedback: FeedbackSummary) {
  const breakdown = Object.entries(feedback.fillerWordBreakdown);

  if (breakdown.length === 0) {
    return "Filler watch: clean run.";
  }

  return `Filler watch: ${breakdown
    .map(([word, count]) => `${word} ${count}`)
    .join(" · ")}`;
}

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const lastSessionSnapshot = useMemo(() => loadLastSessionSnapshot(), []);
  const historyEntry = useMemo(
    () => (sessionId ? loadSessionHistoryEntry(sessionId) : null),
    [sessionId],
  );
  const activeSnapshot = useMemo(() => {
    if (historyEntry) {
      return {
        completedAt: historyEntry.completedAt,
        id: historyEntry.id,
        payload: historyEntry.payload,
      };
    }

    if (lastSessionSnapshot && (!sessionId || lastSessionSnapshot.id === sessionId)) {
      return lastSessionSnapshot;
    }

    return null;
  }, [historyEntry, lastSessionSnapshot, sessionId]);
  const activeScenario = useMemo(
    () =>
      scenarios.find((scenario) => scenario.id === activeSnapshot?.payload.scenario.id) ??
      scenarios[0],
    [activeSnapshot],
  );
  const sessionPayload = useMemo(
    () => activeSnapshot?.payload ?? createMockSessionPayload(activeScenario),
    [activeScenario, activeSnapshot],
  );
  const deterministicFeedback = useMemo(
    () => buildDeterministicFeedbackSummary(sessionPayload),
    [sessionPayload],
  );
  const [feedback, setFeedback] = useState(
    historyEntry?.feedback ?? deterministicFeedback,
  );
  const scoreCards = useMemo(
    () => [
      { label: "Clarity", value: feedback.scores.clarity },
      { label: "Confidence", value: feedback.scores.confidence },
      { label: "Pace", value: feedback.scores.pace },
      { label: "Presence", value: feedback.scores.eyeContactPresence },
    ],
    [feedback],
  );
  const insightCards = useMemo(
    () => [
      { body: feedback.bestMoment, title: "Best moment" },
      { body: feedback.improvementArea, title: "Improvement area" },
      { body: feedback.nextChallenge, title: "Next challenge" },
    ],
    [feedback],
  );

  useEffect(() => {
    setFeedback(historyEntry?.feedback ?? deterministicFeedback);
  }, [deterministicFeedback, historyEntry]);

  useEffect(() => {
    if (!activeSnapshot || historyEntry) {
      return undefined;
    }

    let cancelled = false;
    upsertSessionHistoryEntry(buildSessionHistoryEntry(activeSnapshot));

    void requestSessionFeedback(activeSnapshot.payload).then((summary) => {
      if (cancelled) {
        return;
      }

      setFeedback(summary);
      upsertSessionHistoryEntry(
        buildSessionHistoryEntry(activeSnapshot, summary),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [activeSnapshot, historyEntry]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description={feedback.coachSummary}
          eyebrow="Session Results"
          title={getResultsTitle(feedback)}
          actions={
            <>
              <Button size="lg" to={`/session/${activeScenario.id}`} variant="secondary">
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
              <Button size="lg" to="/scenarios">
                Another scenario
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {scoreCards.map((score) => (
            <Panel key={score.label} className="p-5" elevated>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  {score.label}
                </p>
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-4 text-3xl font-semibold">{score.value}%</p>
              <div className="mt-4">
                <ProgressBar value={score.value} />
              </div>
            </Panel>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            {insightCards.map((insight) => (
              <Panel key={insight.title} className="p-6" elevated>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  {insight.title}
                </p>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  {insight.body}
                </p>
              </Panel>
            ))}
          </div>

          <Panel className="p-6" elevated>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                Transcript summary
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Session highlights</h2>
            </div>

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

            <p className="mt-6 text-sm text-muted-foreground">
              {formatFillerBreakdown(feedback)}
            </p>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
