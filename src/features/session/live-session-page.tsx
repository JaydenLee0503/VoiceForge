import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Radio,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  liveMetrics,
  liveTranscriptSeed,
  performanceSignals,
  scenarios,
} from "@/shared/data/mock";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";

export function LiveSessionPage() {
  const navigate = useNavigate();
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const scenario = useMemo(
    () => scenarios.find((item) => item.id === scenarioId) ?? scenarios[0],
    [scenarioId],
  );

  const [sessionActive, setSessionActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState<typeof liveTranscriptSeed>([]);
  const transcriptAnchor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sessionActive) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sessionActive]);

  useEffect(() => {
    if (!sessionActive || transcript.length >= liveTranscriptSeed.length) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setTranscript((currentTranscript) => [
        ...currentTranscript,
        liveTranscriptSeed[currentTranscript.length],
      ]);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [sessionActive, transcript]);

  useEffect(() => {
    transcriptAnchor.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const timerLabel = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-app-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-app-radial" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 pb-24 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 border-b border-border bg-shell/85 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button size="icon" to="/scenarios" variant="secondary">
                <span aria-hidden>←</span>
              </Button>
              <div>
                <p className="text-sm text-muted-foreground">Live session</p>
                <h1 className="text-xl font-semibold">{scenario.title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-border bg-panel px-4 py-2 text-sm text-muted-foreground">
                {scenario.duration}
              </span>
              <span className="rounded-full border border-border bg-panel px-4 py-2 font-mono text-sm">
                {timerLabel}
              </span>
              {sessionActive && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                  <Radio className="h-4 w-4 animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Panel className="p-6" elevated>
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                    {sessionActive && (
                      <span className="absolute inset-0 rounded-full border border-primary/50 animate-ping" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm text-muted-foreground">AI coach</p>
                    <h2 className="text-2xl font-semibold">Alex</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sessionActive ? "Listening and analyzing in real time" : "Standing by"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-right text-sm text-muted-foreground">
                  <p>Focus</p>
                  <p className="font-medium text-foreground">{scenario.focus}</p>
                </div>
              </div>
            </Panel>

            <Panel className="flex min-h-[480px] flex-col p-6" elevated>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Transcript
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Conversation stream</h2>
                </div>
                <span className="text-sm text-muted-foreground">
                  {transcript.length} events
                </span>
              </div>

              <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-2">
                {transcript.length === 0 && (
                  <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-border bg-shell text-center">
                    <div className="space-y-2 p-8">
                      <p className="text-lg font-medium">Session feed is ready.</p>
                      <p className="text-sm text-muted-foreground">
                        Start the session to populate the live transcript and metrics.
                      </p>
                    </div>
                  </div>
                )}

                {transcript.map((entry, index) => (
                  <div
                    key={`${entry.role}-${index}`}
                    className={cn(
                      "flex gap-4",
                      entry.role === "user" && "justify-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-3xl border px-4 py-4 text-sm leading-7",
                        entry.role === "coach"
                          ? "border-border bg-shell"
                          : "border-primary/25 bg-primary/10",
                      )}
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                        {entry.role === "coach" ? "Coach" : "You"}
                      </p>
                      {entry.text}
                    </div>
                  </div>
                ))}
                <div ref={transcriptAnchor} />
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel className="overflow-hidden p-0" elevated>
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-lg font-semibold">Presence feed</h2>
              </div>
              <div className="relative aspect-video bg-shell">
                {cameraEnabled ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary-soft/10" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(108,141,255,0.18),_transparent_55%)]" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <CameraOff className="h-10 w-10" />
                  </div>
                )}
              </div>
            </Panel>

            <Panel className="p-6" elevated>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Speaking metrics</h2>
                <span className="text-sm text-muted-foreground">Live feedback</span>
              </div>
              <div className="mt-6 space-y-5">
                {liveMetrics.map((metric) => (
                  <div key={metric.label} className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>{metric.label}</span>
                      <span className="font-medium">
                        {metric.label === "Pace" ? "Good" : `${metric.value}%`}
                      </span>
                    </div>
                    <ProgressBar
                      indicatorClassName={cn(
                        metric.tone === "cyan" && "bg-cyan-400",
                        metric.tone === "emerald" && "bg-emerald-400",
                        metric.tone === "violet" && "bg-violet-400",
                      )}
                      value={metric.value}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {performanceSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-border bg-shell px-4 py-4"
                  >
                    <signal.icon className="h-4 w-4 text-primary" />
                    <p className="mt-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-base font-medium">{signal.value}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-shell/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Button
            onClick={() => setMuted((current) => !current)}
            size="icon"
            variant="secondary"
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            onClick={() => setCameraEnabled((current) => !current)}
            size="icon"
            variant="secondary"
          >
            {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </Button>
          {!sessionActive ? (
            <Button
              className="min-w-44"
              onClick={() => setSessionActive(true)}
              size="lg"
            >
              <Play className="h-4 w-4" />
              Start session
            </Button>
          ) : (
            <Button
              className="min-w-44"
              onClick={() => navigate("/results")}
              size="lg"
              variant="danger"
            >
              <PhoneOff className="h-4 w-4" />
              End session
            </Button>
          )}
          <Link className="text-sm text-muted-foreground hover:text-foreground" to="/scenarios">
            Leave session
          </Link>
        </div>
      </footer>
    </div>
  );
}
