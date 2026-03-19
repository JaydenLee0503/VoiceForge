import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { Range } from "@/shared/ui/range";

const STORAGE_KEY = "voiceforge-custom-practice";

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
  const [questionCount, setQuestionCount] = useState(5);
  const [prepTime, setPrepTime] = useState(60);
  const [answerTime, setAnswerTime] = useState(120);

  function startSession() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answerTime, prepTime, questionCount }),
    );
    navigate("/practice/custom/session");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <PageIntro
          description="Configure a lightweight drill session without picking a preset scenario."
          eyebrow="Custom Practice"
          title="Build your own rehearsal"
        />

        <Panel className="p-6 sm:p-8" elevated>
          <div className="space-y-10">
            <RangeField
              label="Practice questions"
              max={12}
              min={3}
              onChange={(value) => setQuestionCount(value)}
              value={questionCount}
            />
            <RangeField
              label="Preparation time"
              max={180}
              min={15}
              onChange={(value) => setPrepTime(value)}
              step={15}
              value={prepTime}
              valueLabel={formatDuration(prepTime)}
            />
            <RangeField
              label="Answer time"
              max={240}
              min={30}
              onChange={(value) => setAnswerTime(value)}
              step={15}
              value={answerTime}
              valueLabel={formatDuration(answerTime)}
            />
          </div>

          <div className="mt-10 flex flex-col gap-4 rounded-3xl border border-border bg-shell p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Estimated session length
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatDuration(questionCount * (prepTime + answerTime))}
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
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
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
