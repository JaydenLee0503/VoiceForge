import { ArrowRight, RotateCcw, Trophy } from "lucide-react";

import {
  resultsInsights,
  resultsScores,
  transcriptHighlights,
} from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";

export function ResultsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description="Pitch Coach session complete. Your pace improved, and the opening landed with more authority."
          eyebrow="Session Results"
          title="Strong finish"
          actions={
            <>
              <Button size="lg" to="/session/pitch-coach" variant="secondary">
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
          {resultsScores.map((score) => (
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
            {resultsInsights.map((insight) => (
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
              {transcriptHighlights.map((highlight) => (
                <div
                  key={highlight.timestamp}
                  className="rounded-2xl border border-border bg-shell p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium">{highlight.label}</p>
                    <span className="font-mono text-sm text-muted-foreground">
                      {highlight.timestamp}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    “{highlight.quote}”
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
