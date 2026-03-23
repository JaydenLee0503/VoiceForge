import {
  Activity,
  Camera,
  CameraOff,
  ChevronLeft,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Scale,
  Shield,
  Sparkles,
  Swords,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { CameraPresencePanel } from "@/components/session/CameraPresencePanel";
import {
  type CameraRecorderStatus,
  useSessionCameraRecorder,
} from "@/hooks/useSessionCameraRecorder";
import { useSessionExitGuard } from "@/hooks/useSessionExitGuard";
import { createUnavailablePresenceResult } from "@/lib/scoring/nonVerbalScore";
import { syncSessionToSupabase } from "@/lib/supabase/session-store";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";
import type { PresenceSessionResult } from "@/types/presence";
import { buildDeterministicDebateResult } from "../../../lib/debate/analysis";
import type {
  DebateRoundPlan,
  DebateSettings,
  SessionAnalysisPayload,
  SessionCameraRecording,
} from "../../../lib/voice-feedback/contracts";
import { saveSessionCameraRecording } from "../session/session-camera-storage";
import {
  createSessionSnapshot,
  saveLastSessionSnapshot,
} from "../session/session-storage";
import { useLiveSession } from "../session/use-live-session";
import {
  buildDebateScenario,
  getDebateDifficultyLabel,
  getDebateDifficultyProfile,
  getDebateJudgeLabel,
  getDebateStanceLabel,
  loadDebateSettings,
} from "./config";
import { buildDebateSessionContext } from "./prompting";

type LivePageStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "disconnecting"
  | "idle";

type RoundState = {
  elapsedSeconds: number;
  index: number;
  progress: number;
  remainingSeconds: number;
  round: DebateRoundPlan;
};

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getConnectionLabel(
  mode: "elevenlabs" | "mock" | null,
  sessionStatus: LivePageStatus,
) {
  if (sessionStatus === "connecting") {
    return "Connecting";
  }

  if (sessionStatus === "disconnecting") {
    return "Ending";
  }

  if (sessionStatus === "disconnected") {
    return "Disconnected";
  }

  if (sessionStatus !== "connected") {
    return "Standby";
  }

  return mode === "mock" ? "Mock arena" : "ElevenLabs live";
}

function getOpponentStatusLine(
  speakerMode: "listening" | "speaking",
  sessionStatus: LivePageStatus,
) {
  if (sessionStatus === "connecting") {
    return "Opening the debate channel";
  }

  if (sessionStatus === "disconnecting") {
    return "Closing the arena";
  }

  if (sessionStatus !== "connected") {
    return "Waiting for launch";
  }

  return speakerMode === "speaking"
    ? "Pressuring the motion in real time"
    : "Listening for the next opening";
}

function buildDebateMockTranscript(settings: DebateSettings) {
  const now = Date.now();

  return [
    {
      id: "debate-mock-0",
      role: "opponent" as const,
      text: `I ${settings.opponentStance === "affirm" ? "affirm" : "oppose"} the motion. The other side confuses convenience with long-term value.`,
      timestamp: now,
    },
    {
      id: "debate-mock-1",
      role: "user" as const,
      text: `I ${settings.userStance === "affirm" ? "affirm" : "oppose"} it because the system already rewards output over reasoning.`,
      timestamp: now + 1200,
    },
    {
      id: "debate-mock-2",
      role: "opponent" as const,
      text: "That skips the real tradeoff. Speed without judgment just scales weaker thinking faster.",
      timestamp: now + 2600,
    },
    {
      id: "debate-mock-3",
      role: "user" as const,
      text: "Only if the system stays passive. Guided use can shift work toward defense, synthesis, and oral reasoning.",
      timestamp: now + 4200,
    },
  ];
}

function buildSessionPayload(
  settings: DebateSettings,
  transcript: SessionAnalysisPayload["transcript"],
  durationSeconds: number,
  cameraRecording: SessionCameraRecording | null,
  presence: PresenceSessionResult | null = null,
): SessionAnalysisPayload {
  const basePayload = {
    cameraRecording,
    customPracticeSettings: null,
    debateResult: null,
    debateSettings: settings,
    durationSeconds,
    generatedQuestions: null,
    mode: "debate" as const,
    presence,
    scenario: buildDebateScenario(settings),
    transcript,
  } satisfies SessionAnalysisPayload;

  return {
    ...basePayload,
    debateResult:
      transcript.some((entry) => entry.role === "user")
        ? buildDeterministicDebateResult(basePayload)
        : null,
  };
}

function getSessionEndPresenceFallback(
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

function getCurrentRoundState(
  roundPlan: DebateRoundPlan[],
  elapsedSeconds: number,
): RoundState {
  let roundStart = 0;

  for (let index = 0; index < roundPlan.length; index += 1) {
    const round = roundPlan[index];
    const roundEnd = roundStart + round.seconds;

    if (elapsedSeconds < roundEnd || index === roundPlan.length - 1) {
      const roundElapsedSeconds = Math.max(0, elapsedSeconds - roundStart);
      const remainingSeconds = Math.max(0, round.seconds - roundElapsedSeconds);

      return {
        elapsedSeconds: roundElapsedSeconds,
        index,
        progress: (roundElapsedSeconds / Math.max(round.seconds, 1)) * 100,
        remainingSeconds,
        round,
      };
    }

    roundStart = roundEnd;
  }

  const fallbackRound = roundPlan[roundPlan.length - 1]!;

  return {
    elapsedSeconds: fallbackRound.seconds,
    index: roundPlan.length - 1,
    progress: 100,
    remainingSeconds: 0,
    round: fallbackRound,
  };
}

function getSpeakerLabel(role: SessionAnalysisPayload["transcript"][number]["role"]) {
  return role === "user" ? "You" : "Opponent";
}

export function DebateSessionPage() {
  const navigate = useNavigate();
  const transcriptAnchor = useRef<HTMLDivElement | null>(null);
  const secondsRef = useRef(0);
  const roundRef = useRef<string | null>(null);
  const [settings, setSettings] = useState<DebateSettings | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [prepRemaining, setPrepRemaining] = useState(0);
  const [isFinalizingSession, setIsFinalizingSession] = useState(false);
  const [sessionDraftId, setSessionDraftId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [hasLaunchedSession, setHasLaunchedSession] = useState(false);
  const {
    disconnectMessage,
    endSession,
    error,
    hasAudioStream,
    mode,
    muted,
    notice,
    sendContextualUpdate,
    sessionStatus,
    speakerMode,
    startSession,
    toggleMuted,
    transcript,
  } = useLiveSession();
  const isConnected = sessionStatus === "connected";
  const isConnecting = sessionStatus === "connecting";
  const isDisconnecting = sessionStatus === "disconnecting";
  const sessionCamera = useSessionCameraRecorder({
    enabled: cameraEnabled,
    isSessionActive: isConnected,
    sessionId: sessionDraftId,
  });

  useEffect(() => {
    const storedSettings = loadDebateSettings();

    if (!storedSettings) {
      navigate("/debate", { replace: true });
      return;
    }

    setSettings(storedSettings);
    setPrepRemaining(storedSettings.prepSeconds);
  }, [navigate]);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    transcriptAnchor.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (!settings || hasLaunchedSession || isFinalizingSession) {
      return undefined;
    }

    if (prepRemaining <= 0) {
      const nextSessionId = `vf-db-${Date.now().toString(36)}`;
      setSessionDraftId(nextSessionId);
      setHasLaunchedSession(true);
      void startSession({
        agentRole: "opponent",
        contextualInstructions: buildDebateSessionContext(settings, settings.roundPlan[0]),
        mockTranscript: buildDebateMockTranscript(settings),
        persona: "debate",
        scenario: buildDebateScenario(settings),
        signedUrlMode: "debate",
      });
      return undefined;
    }

    const interval = window.setInterval(() => {
      setPrepRemaining((value) => value - 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [hasLaunchedSession, isFinalizingSession, prepRemaining, settings, startSession]);

  useEffect(() => {
    if (!isConnected) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isConnected]);

  const totalRoundSeconds = useMemo(
    () => settings?.roundPlan.reduce((total, round) => total + round.seconds, 0) ?? 0,
    [settings],
  );
  const roundState = useMemo(
    () =>
      settings
        ? getCurrentRoundState(settings.roundPlan, Math.min(seconds, totalRoundSeconds))
        : null,
    [seconds, settings, totalRoundSeconds],
  );
  const statusMessage =
    error ??
    notice ??
    (sessionStatus === "disconnected" && transcript.length > 0
      ? disconnectMessage
      : null);
  const difficultyProfile = useMemo(
    () => (settings ? getDebateDifficultyProfile(settings.difficulty) : null),
    [settings],
  );
  const hasPendingSessionExit =
    transcript.length > 0 ||
    prepRemaining < (settings?.prepSeconds ?? 0) ||
    isConnecting ||
    isConnected ||
    isDisconnecting ||
    sessionCamera.isRecording;
  const { allowNextNavigation } = useSessionExitGuard({
    enabled: hasPendingSessionExit,
    message:
      "Discard this debate and leave the arena? Your in-progress transcript and recording will not be saved.",
    onDiscard: async () => {
      await sessionCamera.finalizeRecording();

      if (
        sessionStatus === "connecting" ||
        sessionStatus === "connected" ||
        sessionStatus === "disconnecting"
      ) {
        await endSession();
      }
    },
  });

  useEffect(() => {
    if (!isConnected || !settings || !roundState) {
      return;
    }

    if (roundRef.current === roundState.round.id) {
      return;
    }

    roundRef.current = roundState.round.id;
    void sendContextualUpdate(buildDebateSessionContext(settings, roundState.round));
  }, [isConnected, roundState, sendContextualUpdate, settings]);

  async function finalizeSession() {
    if (isFinalizingSession || !settings) {
      return;
    }

    setIsFinalizingSession(true);

    try {
      const finalizedRecording = await sessionCamera.finalizeRecording();
      const recordingReference: SessionCameraRecording | null =
        finalizedRecording?.recording ?? null;

      if (finalizedRecording) {
        try {
          await saveSessionCameraRecording(
            finalizedRecording.recording,
            finalizedRecording.blob,
          );
        } catch (recordingError) {
          console.warn("[voiceforge] Failed to store debate recording:", recordingError);
        }
      }

      const completedPayload = buildSessionPayload(
        settings,
        transcript,
        Math.min(secondsRef.current, totalRoundSeconds || secondsRef.current),
        recordingReference,
        getSessionEndPresenceFallback(
          cameraEnabled,
          sessionCamera.status,
          recordingReference !== null,
        ),
      );

      if (
        completedPayload.transcript.length > 0 ||
        completedPayload.cameraRecording !== null
      ) {
        const snapshot = createSessionSnapshot(
          completedPayload,
          sessionDraftId ?? undefined,
        );
        saveLastSessionSnapshot(snapshot);
        allowNextNavigation();
        navigate(`/results?session=${snapshot.id}`);
        void endSession();
        void syncSessionToSupabase({
          feedback: null,
          recordingBlob: finalizedRecording?.blob ?? null,
          snapshot,
        }).catch((syncError) => {
          console.warn(
            "[voiceforge] Initial debate upload failed, results page will retry:",
            syncError,
          );
        });
        return;
      }

      allowNextNavigation();
      navigate("/debate");
      void endSession();
    } finally {
      setIsFinalizingSession(false);
    }
  }

  useEffect(() => {
    if (!isConnected || isFinalizingSession || !settings || seconds < totalRoundSeconds) {
      return;
    }

    void finalizeSession();
  }, [isConnected, isFinalizingSession, seconds, settings, totalRoundSeconds]);

  if (!settings || !roundState) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-app-grid opacity-40" />
        <div className="pointer-events-none absolute inset-0 bg-app-radial" />
        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
          <Panel className="w-full max-w-xl p-10 text-center" elevated>
            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-4 text-xl font-semibold">Preparing Debate Mode</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Loading the arena, topic, and round structure.
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  const overallProgress = totalRoundSeconds === 0 ? 0 : (seconds / totalRoundSeconds) * 100;
  const timerLabel = formatTimer(Math.max(totalRoundSeconds - seconds, 0));

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-app-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-app-radial" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 pb-24 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 border-b border-border bg-shell/85 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <Button size="icon" to="/debate" variant="secondary">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-sm text-muted-foreground">Debate Mode</p>
                <h1 className="text-xl font-semibold">{settings.topic}</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-border bg-panel px-4 py-2 text-sm text-muted-foreground">
                {roundState.round.label}
              </span>
              <span className="rounded-full border border-border bg-panel px-4 py-2 text-sm text-muted-foreground">
                {getDebateStanceLabel(settings.userStance)} vs {getDebateStanceLabel(settings.opponentStance)}
              </span>
              <span className="rounded-full border border-border bg-panel px-4 py-2 font-mono text-sm">
                {prepRemaining > 0 ? formatTimer(prepRemaining) : timerLabel}
              </span>
              {isConnecting && (
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Connecting
                </span>
              )}
              {isConnected && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                  <Radio className="h-4 w-4 animate-pulse" />
                  {mode === "mock" ? "Mock live" : "Live"}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Panel className="p-6" elevated>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                    <Swords className="h-6 w-6 text-primary" />
                    {isConnected && (
                      <span className="absolute inset-0 animate-ping rounded-full border border-primary/50" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm text-muted-foreground">AI opponent</p>
                    <h2 className="text-2xl font-semibold">
                      {getDebateDifficultyLabel(settings.difficulty)} Pressure
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getOpponentStatusLine(speakerMode, sessionStatus)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      icon: Shield,
                      label: "Judge",
                      value: getDebateJudgeLabel(settings.judgeStyle),
                    },
                    {
                      icon: Scale,
                      label: "Transport",
                      value: getConnectionLabel(mode, sessionStatus),
                    },
                    {
                      icon: Sparkles,
                      label: "Pressure",
                      value: difficultyProfile
                        ? `${difficultyProfile.aggressiveness}, ${difficultyProfile.rebuttalSharpness}`
                        : "Configuring",
                    },
                    {
                      icon: Activity,
                      label: "Audio",
                      value: hasAudioStream ? "Active" : "Standby",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-border bg-shell px-4 py-3"
                    >
                      <item.icon className="h-4 w-4 text-primary" />
                      <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Overall debate runtime</span>
                    <span>{Math.round(overallProgress)}%</span>
                  </div>
                  <ProgressBar value={overallProgress} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{roundState.round.label}</span>
                    <span>{Math.round(roundState.progress)}%</span>
                  </div>
                  <ProgressBar value={roundState.progress} />
                </div>
              </div>
            </Panel>

            <Panel className="flex min-h-[520px] flex-col p-6" elevated>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Arena feed
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {prepRemaining > 0 ? "Prep countdown" : "Live debate transcript"}
                  </h2>
                </div>

                <div className="rounded-full border border-border bg-shell px-4 py-2 text-sm text-muted-foreground">
                  Round {roundState.index + 1} of {settings.roundPlan.length}
                </div>
              </div>

              {statusMessage && (
                <div
                  className={cn(
                    "mt-6 rounded-2xl border px-4 py-3 text-sm",
                    error && "border-danger/40 bg-danger/10 text-danger",
                    !error && "border-border bg-shell text-muted-foreground",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <TriangleAlert
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        error ? "text-danger" : "text-primary",
                      )}
                    />
                    <p>{statusMessage}</p>
                  </div>
                </div>
              )}

              {prepRemaining > 0 ? (
                <div className="mt-6 flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border bg-shell px-6 py-10">
                  <div className="max-w-2xl text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                      Preparation phase
                    </p>
                    <p className="mt-4 font-mono text-6xl font-semibold">
                      {formatTimer(prepRemaining)}
                    </p>
                    <h3 className="mt-6 text-3xl font-semibold leading-tight">
                      Lock your opening and decide where the first pressure should land.
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">
                      The AI opponent will enter with {difficultyProfile?.aggressiveness ?? "configured pressure"} and {difficultyProfile?.complexity ?? "structured reasoning"}. Use this countdown to pick your first clean claim.
                    </p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                      {settings.roundPlan.map((round) => (
                        <div
                          key={round.id}
                          className="rounded-2xl border border-border bg-panel px-4 py-4 text-left"
                        >
                          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            {round.label}
                          </p>
                          <p className="mt-2 text-lg font-semibold">{round.seconds}s</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {round.prompt}
                          </p>
                        </div>
                      ))}
                    </div>
                    <Button className="mt-8" onClick={() => setPrepRemaining(0)} size="lg">
                      Skip prep and launch
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-2">
                  {transcript.length === 0 ? (
                    <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-border bg-shell text-center">
                      <div className="space-y-2 p-8">
                        <p className="text-lg font-medium">
                          {isConnecting
                            ? "Opening the debate feed..."
                            : "The arena is live."}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isConnecting
                            ? "VoiceForge is requesting the live agent and setting the first round context."
                            : "The transcript will populate as the opponent and your responses land."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    transcript.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn("flex gap-4", entry.role === "user" && "justify-end")}
                      >
                        <div
                          className={cn(
                            "max-w-[82%] rounded-3xl border px-4 py-4 text-sm leading-7",
                            entry.role === "user"
                              ? "border-primary/25 bg-primary/10"
                              : "border-border bg-shell",
                          )}
                        >
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                            {getSpeakerLabel(entry.role)}
                          </p>
                          {entry.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={transcriptAnchor} />
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <CameraPresencePanel
              cameraEnabled={cameraEnabled}
              showDetails={false}
              status={sessionCamera.status}
              statusMessage={sessionCamera.statusMessage}
              videoRef={sessionCamera.videoRef}
            />

            <Panel className="p-6" elevated>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Round state
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">{roundState.round.label}</h2>
                </div>
                <div className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary">
                  {roundState.remainingSeconds}s left
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {roundState.round.prompt}
              </p>

              <div className="mt-6 space-y-4">
                {settings.roundPlan.map((round, index) => {
                  const isActive = round.id === roundState.round.id;
                  const isComplete = index < roundState.index;

                  return (
                    <div
                      key={round.id}
                      className={cn(
                        "rounded-2xl border px-4 py-4",
                        isActive && "border-primary/35 bg-primary/10",
                        !isActive && isComplete && "border-border bg-shell",
                        !isActive && !isComplete && "border-border bg-panel",
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{round.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{round.prompt}</p>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">
                          {round.seconds}s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

          </div>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-shell/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Button
            onClick={() => {
              void toggleMuted();
            }}
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
          <Button
            className="min-w-44"
            disabled={isDisconnecting || isFinalizingSession}
            onClick={() => {
              void finalizeSession();
            }}
            size="lg"
            variant="danger"
          >
            <PhoneOff className="h-4 w-4" />
            {isDisconnecting || isFinalizingSession ? "Ending..." : "End debate"}
          </Button>
          <Link className="text-sm text-muted-foreground hover:text-foreground" to="/debate">
            Leave arena
          </Link>
        </div>
      </footer>
    </div>
  );
}
