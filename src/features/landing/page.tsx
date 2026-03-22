import { ArrowRight, Play, Radar, Target, Waves } from "lucide-react";
import { Link } from "react-router-dom";

import { BrandMark } from "@/shared/brand/BrandMark";
import { landingBenefits, scenarios } from "@/shared/data/mock";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";

export function LandingPage() {
  function scrollToDemoSection() {
    document.getElementById("landing-demo")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-app-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-app-radial" />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <BrandMark />
          <div className="flex items-center gap-3">
            <Button to="/dashboard" variant="ghost">
              Enter workspace
            </Button>
            <Button to="/dashboard">
              Start practicing
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid gap-8 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="max-w-4xl space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              <Radar className="h-4 w-4" />
              Premium AI Speaking Coach
            </div>
            <div className="space-y-5">
              <h1 className="max-w-5xl text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                Mission-control rehearsal for the conversations that matter.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                VoiceForge helps students, creators, founders, and builders sound
                clear, composed, and credible through live AI speaking practice.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="min-w-44" size="lg" to="/dashboard">
                Start practicing
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                className="min-w-44"
                onClick={scrollToDemoSection}
                size="lg"
                variant="secondary"
              >
                <Play className="h-4 w-4" />
                See demo
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {landingBenefits.map((benefit) => (
                <Panel key={benefit.title} className="p-5" elevated>
                  <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {benefit.description}
                  </p>
                </Panel>
              ))}
            </div>
          </div>

          <Panel
            className="relative overflow-hidden p-6 sm:p-8"
            elevated
            id="landing-demo"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Live cockpit
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Voice session preview</h2>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  Analysis online
                </span>
              </div>

              <div className="grid gap-4">
                <div className="rounded-3xl border border-border bg-shell p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active scenario</p>
                      <p className="mt-1 text-xl font-semibold">Pitch Coach</p>
                    </div>
                    <Waves className="h-10 w-10 text-primary" />
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <SignalCard label="Clarity" value="82%" />
                    <SignalCard label="Confidence" value="78%" />
                    <SignalCard label="Pace" value="Stable" />
                  </div>
                </div>

                <div className="grid gap-3">
                  {scenarios.slice(0, 3).map((scenario) => (
                    <Link
                      key={scenario.id}
                      className="rounded-2xl border border-border bg-panel-strong/70 p-4 transition hover:border-primary/40 hover:bg-panel"
                      to={`/session/${scenario.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium">{scenario.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {scenario.description}
                          </p>
                        </div>
                        <Target className="mt-1 h-4 w-4 text-primary" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-panel px-4 py-3">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
