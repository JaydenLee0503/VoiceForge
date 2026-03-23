import {
  ChevronLeft,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CameraPresencePanel } from "@/components/session/CameraPresencePanel";
import { useBrowserSpeechTranscript } from "@/hooks/useBrowserSpeechTranscript";
import {
  type CameraRecorderStatus,
  useSessionCameraRecorder,
} from "@/hooks/useSessionCameraRecorder";
import { useSessionExitGuard } from "@/hooks/useSessionExitGuard";
import { createUnavailablePresenceResult } from "@/lib/scoring/nonVerbalScore";
import { syncSessionToSupabase } from "@/lib/supabase/session-store";
import { buildDisplayTranscript, buildRawTranscript } from "@/lib/transcript/formatting";
import { AppShell } from "@/shared/layout/app-shell";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";
import {
  buildVerbalMetricsSummary,
} from "../../../lib/voice-feedback/analysis";
import type {
  CustomPracticeSettings,
  CustomPracticeTimeline,
  SessionAnalysisPayload,
  SessionCameraRecording,
  SessionQuestionPrompt,
  SessionTranscriptEntry,
} from "../../../lib/voice-feedback/contracts";
import { saveSessionCameraRecording } from "../session/session-camera-storage";
import {
  createSessionSnapshot,
  saveLastSessionSnapshot,
} from "../session/session-storage";
import { requestCustomPracticeQuestions } from "./custom-practice-client";
import {
  buildCustomPracticeScenario,
  loadCustomPracticeSettings,
} from "./custom-practice-storage";

type PracticeStage = "answer" | "loading" | "prep";

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

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

function getPresenceFallback(
  cameraEnabled: boolean,
  cameraStatus: CameraRecorderStatus,
  hasRecording: boolean,
) {
  if (hasRecording) {
    return null;
  }

  if (!cameraEnabled || cameraStatus === "disabled") {
    return createUnavailablePresenceResult("camera_disabled");
  }

  if (cameraStatus === "permission-denied") {
    return createUnavailablePresenceResult("camera_denied");
  }

  if (cameraStatus === "unsupported") {
    return createUnavailablePresenceResult("camera_unsupported");
  }

  if (cameraStatus === "error") {
    return createUnavailablePresenceResult("camera_error");
  }

  return null;
}

function createCustomPracticeTimeline(
  questions: SessionQuestionPrompt[],
): CustomPracticeTimeline {
  return {
    questions: questions.map((question, questionIndex) => ({
      answerEndTimestamp: null,
      answerStartTimestamp: null,
      questionId: question.id,
      questionIndex,
    })),
    recordingStartedAt: null,
  };
}

function markQuestionAnswerStarted(
  timeline: CustomPracticeTimeline | null,
  questionIndex: number,
  startedAt: number,
) {
  if (!timeline) {
    return null;
  }

  return {
    ...timeline,
    questions: timeline.questions.map((question) =>
      question.questionIndex === questionIndex
        ? {
            ...question,
            answerStartTimestamp: question.answerStartTimestamp ?? startedAt,
          }
        : question,
    ),
  } satisfies CustomPracticeTimeline;
}

function markQuestionAnswerEnded(
  timeline: CustomPracticeTimeline | null,
  questionIndex: number,
  endedAt: number,
) {
  if (!timeline) {
    return null;
  }

  return {
    ...timeline,
    questions: timeline.questions.map((question) =>
      question.questionIndex === questionIndex
        ? {
            ...question,
            answerEndTimestamp: question.answerEndTimestamp ?? endedAt,
          }
        : question,
    ),
  } satisfies CustomPracticeTimeline;
}

function markRecordingStarted(
  timeline: CustomPracticeTimeline | null,
  questionIndex: number,
  startedAt: number,
) {
  if (!timeline || timeline.recordingStartedAt !== null) {
    return timeline;
  }

  return {
    recordingStartedAt: startedAt,
    questions: timeline.questions.map((question) =>
      question.questionIndex === questionIndex
        ? {
            ...question,
            answerStartTimestamp: startedAt,
          }
        : question,
    ),
  } satisfies CustomPracticeTimeline;
}

export function CustomPracticeSessionPage() {
  const navigate = useNavigate();
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [config, setConfig] = useState<CustomPracticeSettings | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stage, setStage] = useState<PracticeStage>("loading");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [questionSet, setQuestionSet] = useState<Awaited<
    ReturnType<typeof requestCustomPracticeQuestions>
  > | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [promptTurns, setPromptTurns] = useState<SessionTranscriptEntry[]>([]);
  const [captureStarted, setCaptureStarted] = useState(false);
  const [customPracticeTimeline, setCustomPracticeTimeline] =
    useState<CustomPracticeTimeline | null>(null);
  const [sessionId] = useState(() => `vf-cp-${Date.now().toString(36)}`);
  const customPracticeTimelineRef = useRef<CustomPracticeTimeline | null>(null);

  const speechTranscript = useBrowserSpeechTranscript({
    enabled: true,
    isCapturing: stage === "answer" && !isCompleting,
    sessionId,
  });
  const sessionCamera = useSessionCameraRecorder({
    enabled: cameraEnabled,
    isSessionActive: captureStarted && !isCompleting,
    sessionId,
  });

  function commitCustomPracticeTimeline(nextTimeline: CustomPracticeTimeline | null) {
    customPracticeTimelineRef.current = nextTimeline;
    setCustomPracticeTimeline(nextTimeline);
    return nextTimeline;
  }

  function updateCustomPracticeTimeline(
    transform: (current: CustomPracticeTimeline | null) => CustomPracticeTimeline | null,
  ) {
    return commitCustomPracticeTimeline(transform(customPracticeTimelineRef.current));
  }

  function beginAnswerStage(targetQuestionIndex: number) {
    if (!config) {
      return;
    }

    updateCustomPracticeTimeline((current) =>
      markQuestionAnswerStarted(current, targetQuestionIndex, Date.now()),
    );
    setStage("answer");
    setTimeLeft(config.answerTime);
    setCaptureStarted(true);
  }

  function completeAnswerStage(targetQuestionIndex: number) {
    updateCustomPracticeTimeline((current) =>
      markQuestionAnswerEnded(current, targetQuestionIndex, Date.now()),
    );
  }

  useEffect(() => {
    const storedConfig = loadCustomPracticeSettings();

    if (!storedConfig) {
      navigate("/practice/custom", { replace: true });
      return;
    }

    setConfig(storedConfig);

    void requestCustomPracticeQuestions({
      audience: storedConfig.audience,
      goal: storedConfig.goal,
      intensity: storedConfig.intensity,
      questionCount: storedConfig.questionCount,
      topic: storedConfig.topic,
    }).then((response) => {
      commitCustomPracticeTimeline(createCustomPracticeTimeline(response.questions));
      setQuestionSet(response);
      setStage("prep");
      setTimeLeft(storedConfig.prepTime);
    });
  }, [navigate]);

  const currentQuestion = questionSet?.questions[questionIndex] ?? null;

  useEffect(() => {
    if (!currentQuestion) {
      return;
    }

    setPromptTurns((currentTurns) => {
      const nextTurnId = `prompt-${currentQuestion.id}`;

      if (currentTurns.some((turn) => turn.id === nextTurnId)) {
        return currentTurns;
      }

      return [
        ...currentTurns,
        {
          id: nextTurnId,
          role: "coach",
          text: currentQuestion.text,
          timestamp: Date.now(),
        },
      ];
    });
  }, [currentQuestion]);

  const transcript = useMemo(
    () =>
      [...promptTurns, ...speechTranscript.transcript].sort(
        (left, right) => left.timestamp - right.timestamp,
      ),
    [promptTurns, speechTranscript.transcript],
  );
  const scenario = useMemo(
    () => (config ? buildCustomPracticeScenario(config) : null),
    [config],
  );
  const basePayload = useMemo<SessionAnalysisPayload | null>(() => {
    if (!config || !scenario || !questionSet) {
      return null;
    }

    return {
      cameraRecording: null,
      customPracticeSettings: config,
      customPracticeTimeline,
      displayTranscript: buildDisplayTranscript(transcript),
      durationSeconds: elapsedSeconds,
      generatedQuestions: questionSet.questions,
      presence: null,
      rawTranscript: buildRawTranscript(transcript),
      scenario,
      transcript,
      verbalMetrics: null,
    };
  }, [config, customPracticeTimeline, elapsedSeconds, questionSet, scenario, transcript]);
  const payload = useMemo(() => {
    if (!basePayload) {
      return null;
    }

    return {
      ...basePayload,
      verbalMetrics: buildVerbalMetricsSummary(basePayload),
    } satisfies SessionAnalysisPayload;
  }, [basePayload]);
  const stageDuration = config
    ? stage === "prep"
      ? config.prepTime
      : config.answerTime
    : 1;
  const stageProgress = ((stageDuration - timeLeft) / Math.max(stageDuration, 1)) * 100;
  const questionProgress =
    config && questionSet
      ? ((questionIndex + (stage === "answer" ? 0.5 : 0)) / questionSet.questions.length) *
        100
      : 0;
  const hasPendingSessionExit =
    !isCompleting &&
    (captureStarted ||
      elapsedSeconds > 0 ||
      questionIndex > 0 ||
      speechTranscript.transcript.length > 0 ||
      sessionCamera.isRecording);
  const { allowNextNavigation } = useSessionExitGuard({
    enabled: hasPendingSessionExit,
    message:
      "Discard this in-progress custom practice session and leave the page? Your current drill progress will not be saved.",
    onDiscard: async () => {
      await sessionCamera.finalizeRecording();
    },
  });

  useEffect(() => {
    if (
      stage !== "answer" ||
      sessionCamera.status !== "recording" ||
      customPracticeTimelineRef.current?.recordingStartedAt !== null
    ) {
      return;
    }

    updateCustomPracticeTimeline((current) =>
      markRecordingStarted(current, questionIndex, Date.now()),
    );
  }, [questionIndex, sessionCamera.status, stage]);

  useEffect(() => {
    if (!config || !questionSet || stage === "loading" || isCompleting) {
      return undefined;
    }

    if (timeLeft === 0) {
      if (stage === "prep") {
        beginAnswerStage(questionIndex);
      } else if (questionIndex + 1 < questionSet.questions.length) {
        completeAnswerStage(questionIndex);
        setQuestionIndex((value) => value + 1);
        setStage("prep");
        setTimeLeft(config.prepTime);
      } else {
        completeAnswerStage(questionIndex);
        void finalizeSession(true);
      }

      return undefined;
    }

    const interval = window.setInterval(() => {
      setTimeLeft((value) => value - 1);
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [config, isCompleting, questionIndex, questionSet, stage, timeLeft]);

  async function finalizeSession(navigateToResults: boolean) {
    if (isCompleting || !config || !scenario || !questionSet || !payload) {
      return;
    }

    setIsCompleting(true);

    const finalizedRecording = await sessionCamera.finalizeRecording();
    let recordingReference: SessionCameraRecording | null =
      finalizedRecording?.recording ?? null;
    let presenceFallback = getPresenceFallback(
      cameraEnabled,
      sessionCamera.status,
      finalizedRecording !== null,
    );

    if (finalizedRecording) {
      try {
        await saveSessionCameraRecording(
          finalizedRecording.recording,
          finalizedRecording.blob,
        );
      } catch (error) {
        console.warn("[voiceforge] Failed to store custom practice recording:", error);
      }
    }

    const finalPayloadBase: SessionAnalysisPayload = {
      ...payload,
      cameraRecording: recordingReference,
      customPracticeTimeline: customPracticeTimelineRef.current,
      presence:
        presenceFallback ??
        getPresenceFallback(cameraEnabled, sessionCamera.status, recordingReference !== null),
    };
    const finalPayload: SessionAnalysisPayload = {
      ...finalPayloadBase,
      verbalMetrics: buildVerbalMetricsSummary(finalPayloadBase),
    };

    if (
      navigateToResults &&
      (finalPayload.transcript.length > 0 || finalPayload.cameraRecording !== null)
    ) {
      const snapshot = createSessionSnapshot(finalPayload, sessionId);
      saveLastSessionSnapshot(snapshot);

      allowNextNavigation();
      navigate(`/results?session=${snapshot.id}`);
      void syncSessionToSupabase({
        feedback: null,
        recordingBlob: finalizedRecording?.blob ?? null,
        snapshot,
      }).catch((error) => {
        console.warn(
          "[voiceforge] Initial custom practice upload failed, results page will retry:",
          error,
        );
      });
      return;
    }

    allowNextNavigation();
    navigate("/practice/custom");
  }

  if (!config || !questionSet || !currentQuestion || !payload) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-8">
          <Panel className="p-10 text-center" elevated>
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-4 text-xl font-semibold">Preparing your timed drill</p>
            <p className="mt-3 text-sm text-muted-foreground">
              VoiceForge is lining up your prompts and timers.
            </p>
          </Panel>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <Panel className="p-6" elevated>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Button size="icon" to="/practice/custom" variant="secondary">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Custom practice
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold">
                    Question {questionIndex + 1} of {questionSet.questions.length}
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Work through each prompt, use the prep timer honestly, and move to the
                next answer when you are ready.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-border bg-shell px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Stage
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {stage === "prep" ? "Prep time" : "Response"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-shell px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Timer
                </p>
                <p className="mt-2 font-mono text-2xl font-semibold">
                  {formatTimer(timeLeft)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Session progress</span>
                <span>{Math.round(questionProgress)}%</span>
              </div>
              <ProgressBar value={questionProgress} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{stage === "prep" ? "Prep countdown" : "Answer countdown"}</span>
                <span>{Math.round(stageProgress)}%</span>
              </div>
              <ProgressBar value={stageProgress} />
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel className="p-8 sm:p-10" elevated>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              {stage === "prep" ? "Preparation phase" : "Response phase"}
            </p>
            <h2 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">
              {currentQuestion.text}
            </h2>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Questions",
                  value: String(config.questionCount),
                },
                {
                  label: "Prep time",
                  value: formatDuration(config.prepTime),
                },
                {
                  label: "Answer time",
                  value: formatDuration(config.answerTime),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-shell px-4 py-4"
                >
                  <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-6">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {stage === "prep" ? (
                <Button
                  onClick={() => {
                    beginAnswerStage(questionIndex);
                  }}
                >
                  Start answer
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    completeAnswerStage(questionIndex);

                    if (questionIndex + 1 < questionSet.questions.length) {
                      setQuestionIndex((value) => value + 1);
                      setStage("prep");
                      setTimeLeft(config.prepTime);
                    } else {
                      void finalizeSession(true);
                    }
                  }}
                >
                  {questionIndex + 1 < questionSet.questions.length
                    ? "Next prompt"
                    : "Finish session"}
                </Button>
              )}

              <Button
                onClick={() => {
                  if (stage === "answer") {
                    completeAnswerStage(questionIndex);
                  }

                  void finalizeSession(true);
                }}
                variant="secondary"
              >
                End session
              </Button>
              <Button
                onClick={() => setCameraEnabled((current) => !current)}
                variant="ghost"
              >
                {cameraEnabled ? "Camera on" : "Camera off"}
              </Button>
            </div>
          </Panel>

          <div className="space-y-6">
            <CameraPresencePanel
              cameraEnabled={cameraEnabled}
              status={sessionCamera.status}
              statusMessage={
                stage === "prep"
                  ? "Camera preview is ready. Recording and post-session presence analysis begin when the answer stage starts."
                  : sessionCamera.statusMessage
              }
              videoRef={sessionCamera.videoRef}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
