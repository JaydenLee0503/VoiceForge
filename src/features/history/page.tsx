import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { historySummary, recentSessions } from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Panel } from "@/shared/ui/panel";

export function SessionHistoryPage() {
  const [query, setQuery] = useState("");

  const filteredSessions = useMemo(
    () =>
      recentSessions.filter((session) =>
        session.scenario.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description="Review past sessions, spot patterns, and decide what the next repetition should train."
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
          {historySummary.map((item) => (
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
                <Button className="w-full lg:w-auto" to={`/results?session=${session.id}`} variant="secondary">
                  View
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        {filteredSessions.length === 0 && (
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
