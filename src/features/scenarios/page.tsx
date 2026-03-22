import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { scenarioCategories, scenarios } from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Input } from "@/shared/ui/input";
import { Panel } from "@/shared/ui/panel";
import { SegmentedControl } from "@/shared/ui/segmented-control";

type ScenarioFilter = "all" | "everyday" | "high-stakes" | "identity";

export function ScenariosPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ScenarioFilter>("all");

  const filteredScenarios = useMemo(
    () =>
      scenarios.filter((scenario) => {
        const matchesCategory = category === "all" || scenario.category === category;
        const matchesQuery =
          scenario.title.toLowerCase().includes(query.toLowerCase()) ||
          scenario.description.toLowerCase().includes(query.toLowerCase()) ||
          scenario.focus.toLowerCase().includes(query.toLowerCase());

        return matchesCategory && matchesQuery;
      }),
    [category, query],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description="Choose a rehearsal lane. Every scenario is scoped for clarity, not busywork."
          eyebrow="Scenario Picker"
          title="Practice scenarios"
          actions={
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search scenarios"
                value={query}
              />
            </div>
          }
        />

        <SegmentedControl
          onChange={setCategory}
          options={scenarioCategories}
          value={category}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredScenarios.map((scenario) => (
            <Link
              key={scenario.id}
              aria-label={`Open ${scenario.title}`}
              className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              to={`/session/${scenario.id}`}
            >
              <Panel
                className="flex h-full flex-col p-6 transition duration-200 hover:border-primary/40 hover:bg-panel hover:shadow-glow"
                elevated
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-shell">
                    <scenario.icon className="h-5 w-5 text-primary" />
                  </span>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {scenario.difficulty}
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  <h2 className="text-2xl font-semibold">{scenario.title}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {scenario.description}
                  </p>
                </div>

                <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
                  <div className="rounded-2xl border border-border bg-shell px-4 py-3">
                    Focus: <span className="text-foreground">{scenario.focus}</span>
                  </div>
                  <div className="rounded-2xl border border-border bg-shell px-4 py-3">
                    Estimated time: <span className="text-foreground">{scenario.duration}</span>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-foreground transition group-hover:border-primary/40">
                  Start practice
                </div>
              </Panel>
            </Link>
          ))}
        </div>

        {filteredScenarios.length === 0 && (
          <Panel className="p-10 text-center" elevated>
            <p className="text-xl font-semibold">No scenarios match this filter.</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Broaden the search or switch the category lane.
            </p>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
