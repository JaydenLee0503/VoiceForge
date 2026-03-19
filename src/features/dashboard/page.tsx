import { ArrowRight, Play, TrendingUp } from "lucide-react";

import {
  dashboardStats,
  focusAreas,
  recentSessions,
  scenarios,
  weeklyPerformance,
} from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";

export function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description="Your speaking system is active. Keep the loop tight: rehearse, review, refine."
          eyebrow="Dashboard"
          title="Welcome back, Alex"
          actions={
            <Button size="lg" to="/scenarios">
              <Play className="h-4 w-4" />
              Start session
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardStats.map((stat) => (
            <Panel key={stat.label} className="p-5" elevated>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-tight">{stat.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{stat.detail}</p>
            </Panel>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <Panel className="p-6" elevated>
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Continue practicing
                  </p>
                  <h2 className="text-2xl font-semibold">Pitch Coach</h2>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                    Resume the scenario you left in progress and tighten your opening
                    narrative before the investor update.
                  </p>
                </div>
                <Button to="/session/pitch-coach" variant="secondary">
                  Resume
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Confidence mastery</span>
                  <span className="font-medium">65%</span>
                </div>
                <ProgressBar value={65} />
              </div>
            </Panel>

            <Panel className="p-6" elevated>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Weekly signal
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Practice trend</h2>
                </div>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-6 flex h-64 items-end gap-3 rounded-3xl border border-border bg-shell px-5 pb-5 pt-8">
                {weeklyPerformance.map((value, index) => (
                  <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-3">
                    <div className="flex h-full w-full items-end">
                      <div
                        className="w-full rounded-t-2xl bg-gradient-to-t from-primary to-primary-soft"
                        style={{ height: `${value}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            {focusAreas.map((area) => (
              <Panel key={area.title} className="p-6" elevated>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  {area.title}
                </p>
                <h3 className="mt-3 text-xl font-semibold">{area.detail}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{area.body}</p>
              </Panel>
            ))}

            <Panel className="p-6" elevated>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Recent sessions</h3>
                <Button to="/history" variant="ghost">
                  View all
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                {recentSessions.slice(0, 3).map((session) => (
                  <a
                    key={session.id}
                    className="block rounded-2xl border border-border bg-shell p-4 transition hover:border-primary/40"
                    href={`/results?session=${session.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{session.scenario}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{session.date}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{session.duration}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-border px-3 py-2">
                        Confidence <span className="float-right font-medium">{session.confidence}%</span>
                      </div>
                      <div className="rounded-2xl border border-border px-3 py-2">
                        Clarity <span className="float-right font-medium">{session.clarity}%</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Panel>

            <Panel className="p-6" elevated>
              <h3 className="text-xl font-semibold">Scenario shortcuts</h3>
              <div className="mt-5 grid gap-3">
                {scenarios.slice(0, 3).map((scenario) => (
                  <Button
                    key={scenario.id}
                    className="justify-between"
                    to={`/session/${scenario.id}`}
                    variant="secondary"
                  >
                    <span>{scenario.title}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
