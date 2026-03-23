import { ArrowRight, Flame, Shield, Sparkles, Swords, Zap } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Textarea } from "@/shared/ui/textarea";
import type { DebateSettings, DebateStance } from "../../../lib/voice-feedback/contracts";

import {
  DEFAULT_DEBATE_SETTINGS,
  debateDifficultyOptions,
  debateLengthOptions,
  debateStanceOptions,
  debateTopics,
  finalizeDebateSettings,
  getDebateDifficultyLabel,
  getDebateStanceLabel,
  loadDebateSettings,
  normalizeDebateSettings,
  saveDebateSettings,
} from "./config";

type StanceMode = "assigned" | "manual";

function createPinnedSettings(settings?: Partial<DebateSettings> | null) {
  return normalizeDebateSettings({
    ...settings,
    audienceStyle: DEFAULT_DEBATE_SETTINGS.audienceStyle,
    judgeStyle: DEFAULT_DEBATE_SETTINGS.judgeStyle,
    roundFormat: DEFAULT_DEBATE_SETTINGS.roundFormat,
  });
}

export function DebateModePage() {
  const navigate = useNavigate();
  const persistedSettings = createPinnedSettings(loadDebateSettings() ?? DEFAULT_DEBATE_SETTINGS);
  const [settings, setSettings] = useState<DebateSettings>(persistedSettings);
  const [customTopic, setCustomTopic] = useState(
    persistedSettings.topicId === null ? persistedSettings.topic : "",
  );

  const stanceMode: StanceMode = settings.assignedStance ? "assigned" : "manual";

  function updateSettings(nextSettings: Partial<DebateSettings>) {
    setSettings((current) => createPinnedSettings({ ...current, ...nextSettings }));
  }

  function handleTopicSelect(topicId: string) {
    const nextTopic = debateTopics.find((option) => option.id === topicId);

    if (!nextTopic) {
      return;
    }

    setCustomTopic("");
    updateSettings({
      topic: nextTopic.title,
      topicId: nextTopic.id,
    });
  }

  function handleCustomTopicChange(value: string) {
    setCustomTopic(value);
    const trimmedValue = value.trim();

    if (trimmedValue.length === 0) {
      const fallbackTopic =
        debateTopics.find((option) => option.id === settings.topicId) ?? debateTopics[0];

      updateSettings({
        topic: fallbackTopic.title,
        topicId: fallbackTopic.id,
      });
      return;
    }

    updateSettings({
      topic: trimmedValue,
      topicId: null,
    });
  }

  function handleStanceChange(userStance: DebateStance) {
    updateSettings({
      userStance,
    });
  }

  const hasTopicSelection = customTopic.trim().length > 0 || settings.topicId !== null;
  const hasDifficultySelection = debateDifficultyOptions.some(
    (option) => option.value === settings.difficulty,
  );
  const hasLengthSelection = debateLengthOptions.some(
    (option) => option.value === settings.lengthMinutes,
  );
  const hasPositionSelection =
    settings.assignedStance ||
    debateStanceOptions.some((option) => option.value === settings.userStance);
  const isLaunchReady =
    hasTopicSelection &&
    hasDifficultySelection &&
    hasLengthSelection &&
    hasPositionSelection;

  function launchDebate() {
    if (!isLaunchReady) {
      return;
    }

    const activeTopic = customTopic.trim() || settings.topic;
    const preparedSettings = finalizeDebateSettings(
      createPinnedSettings({
        ...settings,
        topic: activeTopic,
        topicId: customTopic.trim().length > 0 ? null : settings.topicId,
      }),
    );

    saveDebateSettings(preparedSettings);
    navigate("/debate/session");
  }

  const activeMotion = customTopic.trim() || settings.topic;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageIntro
          description="Pick the motion, set the pressure, and drop straight into a live AI debate with score, badges, and a clean final verdict."
          eyebrow="Debate Mode"
          title="Live debate arena"
          actions={
            <Button disabled={!isLaunchReady} onClick={launchDebate} size="lg">
              Enter debate
              <ArrowRight className="h-4 w-4" />
            </Button>
          }
        />

        <Panel className="p-4 sm:p-5" elevated>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Swords,
                label: "Live rounds",
                value: "3-phase duel",
              },
              {
                icon: Zap,
                label: "Gamification",
                value: "Score + badges",
              },
              {
                icon: Shield,
                label: "Decision",
                value: "Win / draw / loss",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-shell px-4 py-4"
              >
                <item.icon className="h-4 w-4 text-primary" />
                <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-base font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Panel className="p-6" elevated>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Motion
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Choose the topic</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {debateTopics.map((topic) => {
                  const selected = settings.topicId === topic.id && customTopic.trim().length === 0;

                  return (
                    <button
                      key={topic.id}
                      className={cn(
                        "rounded-3xl border px-5 py-5 text-left transition",
                        selected
                          ? "border-primary/40 bg-primary/10 shadow-glow"
                          : "border-border bg-shell hover:border-primary/30 hover:bg-panel-strong",
                      )}
                      onClick={() => handleTopicSelect(topic.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold">{topic.title}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {topic.cue}
                          </p>
                        </div>
                        <Flame className="mt-1 h-4 w-4 text-primary" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-3xl border border-border bg-shell px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Custom motion
                </p>
                <Textarea
                  className="mt-4 min-h-[120px]"
                  onChange={(event) => handleCustomTopicChange(event.target.value)}
                  placeholder="Example: AI companions should become a standard part of education."
                  value={customTopic}
                />
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel className="p-6" elevated>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Arena Settings
                </p>
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Pick the pressure</h2>

              <div className="mt-6 space-y-6">
                <ConfigField label="Difficulty">
                  <SegmentedControl
                    onChange={(value) =>
                      updateSettings({
                        difficulty: value as DebateSettings["difficulty"],
                      })
                    }
                    options={debateDifficultyOptions}
                    value={settings.difficulty}
                  />
                </ConfigField>

                <ConfigField label="Debate length">
                  <SegmentedControl
                    onChange={(value) =>
                      updateSettings({
                        lengthMinutes: Number(value) as DebateSettings["lengthMinutes"],
                      })
                    }
                    options={debateLengthOptions.map((option) => ({
                      label: option.label,
                      value: String(option.value),
                    }))}
                    value={String(settings.lengthMinutes)}
                  />
                </ConfigField>

                <ConfigField label="Position">
                  <div className="space-y-4">
                    <SegmentedControl
                      onChange={(value) =>
                        updateSettings({
                          assignedStance: value === "assigned",
                        })
                      }
                      options={[
                        { label: "Choose stance", value: "manual" },
                        { label: "Assign randomly", value: "assigned" },
                      ]}
                      value={stanceMode}
                    />

                    {stanceMode === "manual" ? (
                      <SegmentedControl
                        onChange={(value) => handleStanceChange(value as DebateStance)}
                        options={debateStanceOptions}
                        value={settings.userStance}
                      />
                    ) : (
                      <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 text-sm text-primary">
                        Your side will be assigned at launch so the arena stays replayable.
                      </div>
                    )}
                  </div>
                </ConfigField>
              </div>
            </Panel>

            <Panel className="p-6" elevated>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                Launch
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Go live</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                The arena opens fast. You get a prep countdown, a live opponent, round score pressure, badges, and a final verdict when the debate ends.
              </p>

              <div className="mt-6 rounded-3xl border border-border bg-shell px-5 py-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Motion
                </p>
                <p className="mt-3 text-2xl font-semibold leading-tight">{activeMotion}</p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-full border border-border bg-panel px-4 py-2 text-sm text-foreground">
                    {getDebateDifficultyLabel(settings.difficulty)}
                  </span>
                  <span className="rounded-full border border-border bg-panel px-4 py-2 text-sm text-foreground">
                    {settings.lengthMinutes} min
                  </span>
                  <span className="rounded-full border border-border bg-panel px-4 py-2 text-sm text-foreground">
                    {settings.assignedStance ? "Random side" : getDebateStanceLabel(settings.userStance)}
                  </span>
                </div>
              </div>

              {!isLaunchReady && (
                <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-4 text-sm text-danger">
                  Complete topic, difficulty, debate length, and position before launching the arena.
                </div>
              )}

              <Button
                className="mt-6 w-full"
                disabled={!isLaunchReady}
                onClick={launchDebate}
                size="lg"
              >
                Launch debate
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ConfigField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
