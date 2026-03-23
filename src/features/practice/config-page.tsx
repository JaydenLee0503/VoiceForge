import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { Range } from "@/shared/ui/range";
import type { CustomPracticeSettings } from "../../../lib/voice-feedback/contracts";

import {
  DEFAULT_CUSTOM_PRACTICE_SETTINGS,
  loadCustomPracticeSettings,
  MAX_CUSTOM_PRACTICE_QUESTION_COUNT,
  MIN_CUSTOM_PRACTICE_QUESTION_COUNT,
  normalizeCustomPracticeSettings,
  saveCustomPracticeSettings,
} from "./custom-practice-storage";

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (remainder === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainder}s`;
}

export function CustomPracticeConfigPage() {
  const navigate = useNavigate();
  const persistedSettings =
    loadCustomPracticeSettings() ?? DEFAULT_CUSTOM_PRACTICE_SETTINGS;
  const [settings, setSettings] = useState<CustomPracticeSettings>(persistedSettings);

  const estimatedSessionLength = useMemo(
    () => settings.questionCount * (settings.prepTime + settings.answerTime),
    [settings.answerTime, settings.prepTime, settings.questionCount],
  );

  function updateSetting(
    key: "answerTime" | "prepTime" | "questionCount",
    value: number,
  ) {
    setSettings((current) =>
      normalizeCustomPracticeSettings({
        ...current,
        [key]: value,
      }),
    );
  }

  function startSession() {
    saveCustomPracticeSettings(normalizeCustomPracticeSettings(settings));
    navigate("/practice/custom/session");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <PageIntro
          description="Choose the length of the drill and start. VoiceForge will handle the prompts."
          eyebrow="Custom Practice"
          title="Timed speaking drill"
        />

        <Panel className="p-6 sm:p-8" elevated>
          <div className="space-y-8">
            <RangeField
              label="Number of questions"
              max={MAX_CUSTOM_PRACTICE_QUESTION_COUNT}
              min={MIN_CUSTOM_PRACTICE_QUESTION_COUNT}
              onChange={(value) => updateSetting("questionCount", value)}
              value={settings.questionCount}
            />
            <RangeField
              label="Preparation time"
              max={180}
              min={15}
              onChange={(value) => updateSetting("prepTime", value)}
              step={15}
              value={settings.prepTime}
              valueLabel={formatDuration(settings.prepTime)}
            />
            <RangeField
              label="Answer time"
              max={240}
              min={30}
              onChange={(value) => updateSetting("answerTime", value)}
              step={15}
              value={settings.answerTime}
              valueLabel={formatDuration(settings.answerTime)}
            />

            <div className="rounded-3xl border border-border bg-shell p-5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Estimated total session length</span>
                <span className="font-medium text-foreground">
                  {formatDuration(estimatedSessionLength)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                VoiceForge will generate a simple timed drill and move you from prep
                into answer mode automatically.
              </p>
            </div>

            <Button onClick={startSession} size="lg">
              Start custom session
            </Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

type RangeFieldProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
  valueLabel?: string;
};

function RangeField({
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
  valueLabel,
}: RangeFieldProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <label className="text-lg font-medium">{label}</label>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          {valueLabel ?? value}
        </span>
      </div>
      <Range
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        value={value}
      />
    </div>
  );
}
