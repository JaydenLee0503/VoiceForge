import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { practiceQuestions } from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";

const STORAGE_KEY = "voiceforge-custom-practice";

type PracticeConfig = {
  questionCount: number;
  prepTime: number;
  answerTime: number;
};

type PracticeStage = "prep" | "answer" | "complete";

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CustomPracticeSessionPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<PracticeConfig | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stage, setStage] = useState<PracticeStage>("prep");
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const storedConfig = window.localStorage.getItem(STORAGE_KEY);
    if (!storedConfig) {
      navigate("/practice/custom", { replace: true });
      return;
    }

    const parsedConfig = JSON.parse(storedConfig) as PracticeConfig;
    setConfig(parsedConfig);
    setTimeLeft(parsedConfig.prepTime);
  }, [navigate]);

  const selectedQuestions = useMemo(() => {
    if (!config) {
      return [];
    }

    return practiceQuestions.slice(0, config.questionCount);
  }, [config]);

  useEffect(() => {
    if (!config || stage === "complete") {
      return undefined;
    }

    if (timeLeft === 0) {
      if (stage === "prep") {
        setStage("answer");
        setTimeLeft(config.answerTime);
      } else if (questionIndex + 1 < config.questionCount) {
        setQuestionIndex((value) => value + 1);
        setStage("prep");
        setTimeLeft(config.prepTime);
      } else {
        setStage("complete");
      }

      return undefined;
    }

    const interval = window.setInterval(() => {
      setTimeLeft((value) => value - 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [config, questionIndex, stage, timeLeft]);

  if (!config || selectedQuestions.length === 0) {
    return null;
  }

  if (stage === "complete") {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl space-y-8">
          <Panel className="p-10 text-center" elevated>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Custom Practice Complete
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              {config.questionCount} prompts completed
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              The structure worked. Keep the next session short and repeat tomorrow
              while the learning is still fresh.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/practice/custom" variant="secondary">
                Reconfigure
              </Button>
              <Button to="/dashboard">Back to dashboard</Button>
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  const questionProgress = (questionIndex / config.questionCount) * 100;
  const stageDuration = stage === "prep" ? config.prepTime : config.answerTime;
  const stageProgress = ((stageDuration - timeLeft) / stageDuration) * 100;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <Panel className="p-6" elevated>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                Custom practice
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                Question {questionIndex + 1} of {config.questionCount}
              </h1>
            </div>
            <div className="font-mono text-4xl font-semibold">{formatTimer(timeLeft)}</div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Session progress</span>
              <span>{Math.round(questionProgress)}%</span>
            </div>
            <ProgressBar value={questionProgress} />
          </div>
        </Panel>

        <Panel className="p-8 sm:p-10" elevated>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            {stage === "prep" ? "Preparation phase" : "Response phase"}
          </p>
          <h2 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">
            {selectedQuestions[questionIndex]}
          </h2>

          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{stage === "prep" ? "Prep countdown" : "Answer countdown"}</span>
              <span>{Math.round(stageProgress)}%</span>
            </div>
            <ProgressBar value={stageProgress} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {stage === "prep" ? (
              <Button
                onClick={() => {
                  setStage("answer");
                  setTimeLeft(config.answerTime);
                }}
              >
                Skip to answer
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (questionIndex + 1 < config.questionCount) {
                    setQuestionIndex((value) => value + 1);
                    setStage("prep");
                    setTimeLeft(config.prepTime);
                  } else {
                    setStage("complete");
                  }
                }}
              >
                Next question
              </Button>
            )}
            <Button
              onClick={() => navigate("/practice/custom")}
              variant="secondary"
            >
              End session
            </Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
