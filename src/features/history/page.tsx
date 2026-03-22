import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadSessionHistoryFromSupabase } from "@/lib/supabase/session-store";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Panel } from "@/shared/ui/panel";

import {
  formatSessionDuration,
  loadSessionHistory,
  toSessionHistoryListItem,
  upsertSessionHistoryEntry,
} from "../session/session-storage";

function getAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function SessionHistoryPage() {
  const [query, setQuery] = useState("");
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

      setSessionHistory((currentEntries) => {
        const nextEntries = [...currentEntries];

        remoteEntries.forEach((entry) => {
          const existingIndex = nextEntries.findIndex(
            (candidate) => candidate.id === entry.id,
          );

          if (existingIndex >= 0) {
            nextEntries[existingIndex] = entry;
          } else {
            nextEntries.push(entry);
          }
        });

        return nextEntries.sort(
          (left, right) =>
            new Date(right.completedAt).getTime() -
            new Date(left.completedAt).getTime(),
        );
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const historyItems = useMemo(
    () => sessionHistory.map((entry) => toSessionHistoryListItem(entry)),
    [sessionHistory],
  );
  const summaryCards = useMemo(
    () => [
      { label: "Completed", value: String(historyItems.length) },
      {
        label: "Avg. Confidence",
        value: `${getAverage(historyItems.map((item) => item.confidence))}%`,
      },
      {
        label: "Avg. Duration",
        value: formatSessionDuration(
          getAverage(sessionHistory.map((entry) => entry.payload.durationSeconds)),
        ),
      },
    ],
    [historyItems, sessionHistory],
  );
  const filteredSessions = useMemo(
    () =>
      historyItems.filter((session) =>
        session.scenario.toLowerCase().includes(query.toLowerCase()),
      ),
    [historyItems, query],
  );
  const hasHistory = historyItems.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description="Review completed sessions, spot patterns, and decide what the next repetition should train."
          eyebrow="Session History"
          title="Performance log"
          actions={
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sessions"
                value={query}
              />
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((item) => (
            <Panel key={item.label} className="p-5" elevated>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-4 text-3xl font-semibold">{item.value}</p>
            </Panel>
          ))}
        </div>

        <Panel className="overflow-hidden" elevated>
          <div className="hidden border-b border-border bg-shell px-6 py-4 text-xs uppercase tracking-[0.28em] text-muted-foreground lg:grid lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.6fr]">
            <span>Scenario</span>
            <span>Date</span>
            <span>Duration</span>
            <span>Confidence</span>
            <span>Clarity</span>
            <span>Review</span>
          </div>

          <div className="divide-y divide-border">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="grid gap-4 px-6 py-5 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_0.8fr_0.6fr] lg:items-center"
              >
                <div>
                  <p className="font-medium">{session.scenario}</p>
                  <p className="mt-1 text-sm text-muted-foreground lg:hidden">
                    {session.date}
                  </p>
                </div>
                <span className="hidden text-sm text-muted-foreground lg:block">
                  {session.date}
                </span>
                <span className="text-sm text-muted-foreground">{session.duration}</span>
                <span className="text-sm">{session.confidence}%</span>
                <span className="text-sm">{session.clarity}%</span>
                <Button
                  className="w-full lg:w-auto"
                  to={`/results?session=${session.id}`}
                  variant="secondary"
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        {!hasHistory && (
          <Panel className="p-10 text-center" elevated>
            <p className="text-xl font-semibold">No completed sessions yet.</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Finish a live speaking session and it will appear here automatically.
            </p>
            <div className="mt-6">
              <Button to="/scenarios">Start a session</Button>
            </div>
          </Panel>
        )}

        {hasHistory && filteredSessions.length === 0 && (
          <Panel className="p-10 text-center" elevated>
            <p className="text-xl font-semibold">No sessions match this search.</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Try a broader term such as pitch, interview, or story.
            </p>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
