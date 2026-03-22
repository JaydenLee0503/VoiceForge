import { ArrowRight, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { loadSessionHistoryFromSupabase } from "@/lib/supabase/session-store";
import { scenarios } from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";

import {
  formatSessionDate,
  loadSessionHistory,
  type StoredSessionHistoryEntry,
  toSessionHistoryListItem,
  upsertSessionHistoryEntry,
} from "../session/session-storage";

type FocusCard = {
  body: string;
  detail: string;
  title: string;
};

function getAverage(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDifference(later: Date, earlier: Date) {
  return Math.round(
    (startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86_400_000,
  );
}

function sortSessionHistory(entries: StoredSessionHistoryEntry[]) {
  return [...entries].sort(
    (left, right) =>
      new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
  );
}

function mergeSessionHistory(
  currentEntries: StoredSessionHistoryEntry[],
  remoteEntries: StoredSessionHistoryEntry[],
) {
  const nextEntries = [...currentEntries];

  remoteEntries.forEach((entry) => {
    const existingIndex = nextEntries.findIndex((candidate) => candidate.id === entry.id);

    if (existingIndex >= 0) {
      nextEntries[existingIndex] = entry;
    } else {
      nextEntries.push(entry);
    }
  });

  return sortSessionHistory(nextEntries);
}

function getSessionStreak(entries: StoredSessionHistoryEntry[]) {
  const practiceDays = Array.from(
    new Set(entries.map((entry) => startOfDay(new Date(entry.completedAt)).getTime())),
  )
    .sort((left, right) => right - left)
    .map((timestamp) => new Date(timestamp));

  if (practiceDays.length === 0) {
    return 0;
  }

  if (getDayDifference(new Date(), practiceDays[0]) > 1) {
    return 0;
  }

  let streak = 1;

  for (let index = 1; index < practiceDays.length; index += 1) {
    if (getDayDifference(practiceDays[index - 1], practiceDays[index]) !== 1) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function getPrimaryFocus(entries: StoredSessionHistoryEntry[]): FocusCard {
  if (entries.length === 0) {
    return {
      body: "Complete your first speaking session to unlock clarity, confidence, and pace signals here.",
      detail: "No session data yet",
      title: "Today's focus",
    };
  }

  const recentEntries = entries.slice(0, 5);
  const weakestMetric = [
    {
      body: "Tighten transitions and move the main point earlier in each response.",
      label: "Clarity",
      value: getAverage(recentEntries.map((entry) => entry.feedback.scores.clarity)) ?? 0,
    },
    {
      body: "Use more direct phrasing and let the last sentence land without softening it.",
      label: "Confidence",
      value: getAverage(recentEntries.map((entry) => entry.feedback.scores.confidence)) ?? 0,
    },
    {
      body: "Create one clean pause between ideas so the session feels more controlled.",
      label: "Pace",
      value: getAverage(recentEntries.map((entry) => entry.feedback.scores.pace)) ?? 0,
    },
  ].sort((left, right) => left.value - right.value)[0];

  return {
    body: weakestMetric.body,
    detail: `${weakestMetric.label} is the weakest recent signal`,
    title: "Today's focus",
  };
}

function getMomentumCard(entries: StoredSessionHistoryEntry[]): FocusCard {
  if (entries.length === 0) {
    return {
      body: "Recent sessions will start showing trend language here once real history exists.",
      detail: "Waiting for history",
      title: "Momentum",
    };
  }

  const latestEntry = entries[0];
  const latestAverage = Math.round(
    (latestEntry.feedback.scores.clarity +
      latestEntry.feedback.scores.confidence +
      latestEntry.feedback.scores.pace) /
      3,
  );
  const previousAverage = getAverage(
    entries.slice(1, 4).map((entry) =>
      Math.round(
        (entry.feedback.scores.clarity +
          entry.feedback.scores.confidence +
          entry.feedback.scores.pace) /
          3,
      ),
    ),
  );

  if (previousAverage === null) {
    return {
      body: "You have one completed session. Finish another rep to compare movement across attempts.",
      detail: `Latest session: ${formatSessionDate(latestEntry.completedAt)}`,
      title: "Momentum",
    };
  }

  const delta = latestAverage - previousAverage;

  if (delta >= 3) {
    return {
      body: "The latest rep improved on your recent baseline. Reinforce it with another session while it is fresh.",
      detail: `Up ${delta} points versus your recent average`,
      title: "Momentum",
    };
  }

  if (delta <= -3) {
    return {
      body: "The latest session slipped below your recent baseline. Run another rep before the weak spot hardens.",
      detail: `${Math.abs(delta)} points below your recent average`,
      title: "Momentum",
    };
  }

  return {
    body: "Your recent sessions are holding steady. A sharper scenario or custom drill is the next useful move.",
    detail: "Holding near your recent average",
    title: "Momentum",
  };
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value}%`;
}

export function DashboardPage() {
  const [sessionHistory, setSessionHistory] = useState(() => loadSessionHistory());

  useEffect(() => {
    let cancelled = false;

    void loadSessionHistoryFromSupabase().then((remoteEntries) => {
      if (cancelled || remoteEntries.length === 0) {
        return;
      }

      remoteEntries.forEach((entry) => {
        upsertSessionHistoryEntry(entry);
      });

      setSessionHistory((currentEntries) => mergeSessionHistory(currentEntries, remoteEntries));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const historyItems = useMemo(
    () => sessionHistory.map((entry) => toSessionHistoryListItem(entry)),
    [sessionHistory],
  );
  const latestSession = sessionHistory[0] ?? null;
  const latestSessionListItem = latestSession ? toSessionHistoryListItem(latestSession) : null;
  const streak = useMemo(() => getSessionStreak(sessionHistory), [sessionHistory]);
  const confidenceAverage = useMemo(
    () => getAverage(sessionHistory.map((entry) => entry.feedback.scores.confidence)),
    [sessionHistory],
  );
  const clarityAverage = useMemo(
    () => getAverage(sessionHistory.map((entry) => entry.feedback.scores.clarity)),
    [sessionHistory],
  );
  const focusCards = useMemo(
    () => [getPrimaryFocus(sessionHistory), getMomentumCard(sessionHistory)],
    [sessionHistory],
  );
  const summaryCards = useMemo(
    () => [
      {
        detail: sessionHistory.length === 0 ? "no sessions yet" : "completed",
        label: "Sessions",
        value: String(sessionHistory.length),
      },
      {
        detail: streak === 0 ? "start a new streak" : "current cadence",
        label: "Streak",
        value: `${streak} day${streak === 1 ? "" : "s"}`,
      },
      {
        detail: confidenceAverage === null ? "complete a session to unlock" : "rolling average",
        label: "Confidence",
        value: formatPercent(confidenceAverage),
      },
      {
        detail: clarityAverage === null ? "complete a session to unlock" : "rolling average",
        label: "Clarity",
        value: formatPercent(clarityAverage),
      },
    ],
    [clarityAverage, confidenceAverage, sessionHistory.length, streak],
  );
  const recentHistoryItems = historyItems.slice(0, 3);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description={
            latestSession
              ? "Review your latest signal, run another rep, and keep the practice loop moving."
              : "Start a session, build real history, and let the dashboard fill itself with actual practice data."
          }
          eyebrow="Dashboard"
          title="Welcome back"
          actions={
            <Button size="lg" to="/scenarios">
              <Play className="h-4 w-4" />
              Start session
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((stat) => (
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
                    {latestSession ? "Latest session" : "Start practicing"}
                  </p>
                  <h2 className="text-2xl font-semibold">
                    {latestSession ? latestSession.payload.scenario.title : "Choose your first scenario"}
                  </h2>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                    {latestSession
                      ? `Last completed ${formatSessionDate(latestSession.completedAt)}. Re-run the same scenario or branch into a different speaking lane.`
                      : "This dashboard stays empty until you generate real practice data. Start a session and VoiceForge will populate it from actual results."}
                  </p>
                </div>
                <Button
                  to={latestSession ? `/session/${latestSession.payload.scenario.id}` : "/scenarios"}
                  variant="secondary"
                >
                  {latestSession ? "Retry session" : "Choose scenario"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {latestSessionListItem && (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-shell px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Date
                    </p>
                    <p className="mt-2 text-base font-semibold">{latestSessionListItem.date}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-shell px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Confidence
                    </p>
                    <p className="mt-2 text-base font-semibold">
                      {latestSessionListItem.confidence}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-shell px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Clarity
                    </p>
                    <p className="mt-2 text-base font-semibold">{latestSessionListItem.clarity}%</p>
                  </div>
                </div>
              )}
            </Panel>

            <Panel className="p-6" elevated>
              <h3 className="text-xl font-semibold">Scenario shortcuts</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Jump straight back into a high-value rep without digging through the
                picker.
              </p>
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

          <div className="space-y-6">
            {focusCards.map((area) => (
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
              {recentHistoryItems.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {recentHistoryItems.map((session) => (
                    <Link
                      key={session.id}
                      className="block rounded-2xl border border-border bg-shell p-4 transition hover:border-primary/40"
                      to={`/results?session=${session.id}`}
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
                          Confidence{" "}
                          <span className="float-right font-medium">{session.confidence}%</span>
                        </div>
                        <div className="rounded-2xl border border-border px-3 py-2">
                          Clarity{" "}
                          <span className="float-right font-medium">{session.clarity}%</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-border bg-shell p-5">
                  <p className="font-medium">No recent sessions yet.</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Recent session cards will appear here after you complete a practice run.
                  </p>
                </div>
              )}
            </Panel>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
