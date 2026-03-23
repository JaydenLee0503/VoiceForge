import { ArrowRight, LoaderCircle, RotateCcw, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { buildCustomPracticeQuestionReviewSeeds } from "@/features/practice/custom-practice-review";
import { analyzeSessionRecording } from "@/lib/presence/analyzeSessionRecording";
import {
  createUnavailablePresenceResult,
  getPresenceAvailabilityMessage,
  NON_VERBAL_HEURISTIC_NOTE,
  NON_VERBAL_WEIGHT_NOTE,
} from "@/lib/scoring/nonVerbalScore";
import {
  loadSessionHistoryFromSupabase,
  loadSessionRecordingBlobFromSupabase,
  loadSessionSnapshotFromSupabase,
  syncSessionToSupabase,
} from "@/lib/supabase/session-store";
import { scenarios } from "@/shared/data/mock";
import { AppShell } from "@/shared/layout/app-shell";
import { PageIntro } from "@/shared/layout/page-intro";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/panel";
import { ProgressBar } from "@/shared/ui/progress-bar";
import type { PresenceSessionResult } from "@/types/presence";
import { buildDeterministicDebateResult } from "../../../lib/debate/analysis";
import { buildDeterministicFeedbackSummary } from "../../../lib/voice-feedback/analysis";
import type {
  DebateResult,
  FeedbackSummary,
  SessionAnalysisPayload,
} from "../../../lib/voice-feedback/contracts";
import { requestDebateJudgment } from "../debate/judge-client";
import { DebateResultsView } from "../debate/results-view";
import { requestSessionFeedback } from "./feedback-client";
import {
  loadSessionCameraRecording,
  saveSessionCameraRecording,
} from "./session-camera-storage";
import {
  buildSessionHistoryEntry,
  createMockSessionPayload,
  loadLastSessionSnapshot,
  loadSessionHistoryEntry,
  saveLastSessionSnapshot,
  upsertSessionHistoryEntry,
} from "./session-storage";

function getResultsTitle(feedback: FeedbackSummary) {
  const averageScore = Math.round(
    (feedback.scores.clarity +
      feedback.scores.confidence +
      feedback.scores.pace +
      feedback.scores.eyeContactPresence) /
      4,
  );

  if (averageScore >= 85) {
    return "Strong finish";
  }

  if (averageScore >= 74) {
    return "Solid session";
  }

  return "Useful rep";
}

function formatFillerBreakdown(feedback: FeedbackSummary) {
  const breakdown = Object.entries(feedback.fillerWordBreakdown);

  if (breakdown.length === 0) {
    return "Filler watch: clean run.";
  }

  return `Filler watch: ${breakdown
    .map(([word, count]) => `${word} ${count}`)
    .join(", ")}`;
}

function formatPresenceCapture(presence: PresenceSessionResult | null) {
  if (presence?.status !== "ready") {
    return getPresenceAvailabilityMessage(presence?.reason);
  }

  const frameLabel = `${presence.summary.sampledFrames} tracked frames`;
  const speakingLabel =
    presence.summary.speakingFrames > 0
      ? `${presence.summary.speakingFrames} user-speaking frames`
      : "limited speaking capture";

  return `${frameLabel} captured with ${speakingLabel} during the session.`;
}

function getPresenceHeadline(
  presence: PresenceSessionResult | null,
  presenceAnalysisStatus: "analyzing" | "complete" | "idle",
  hasRecording: boolean,
) {
  if (presenceAnalysisStatus === "analyzing" && hasRecording) {
    return "Analyzing saved camera video";
  }

  if (presence?.status === "ready" && presence.nonVerbalScore !== null) {
    return `${presence.nonVerbalScore}% non-verbal score`;
  }

  return "Camera score unavailable";
}

function hasMatchingPresence(
  left: PresenceSessionResult | null | undefined,
  right: PresenceSessionResult | null | undefined,
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

type CustomPracticeQuestionReview = {
  answerText: string;
  feedback: FeedbackSummary;
  presence: PresenceSessionResult | null;
  promptText: string;
  questionIndex: number;
};

function buildQuestionReviewSummary(
  payload: SessionAnalysisPayload,
  feedback: FeedbackSummary,
  presence: PresenceSessionResult | null,
  questionIndex: number,
): CustomPracticeQuestionReview {
  const answerText = payload.transcript
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(" ");

  return {
    answerText,
    feedback,
    presence,
    promptText: payload.generatedQuestions?.[0]?.text ?? `Question ${questionIndex + 1}`,
    questionIndex,
  };
}

async function loadLocalSessionRecordingBlob(recordingId: string) {
  const storedRecording = await loadSessionCameraRecording(recordingId).catch(() => null);
  return storedRecording?.blob ?? null;
}

async function loadAnalysisRecordingBlob(
  sessionId: string,
  recording: SessionAnalysisPayload["cameraRecording"] | null | undefined,
) {
  if (!recording) {
    return null;
  }

  const localBlob = await loadLocalSessionRecordingBlob(recording.id);

  if (localBlob) {
    return localBlob;
  }

  const remoteBlob = await loadSessionRecordingBlobFromSupabase(sessionId);

  if (remoteBlob) {
    try {
      await saveSessionCameraRecording(recording, remoteBlob);
    } catch (error) {
      console.warn("[voiceforge] Failed to restore the session recording locally:", error);
    }
  }

  return remoteBlob;
}

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const lastSessionSnapshot = useMemo(() => loadLastSessionSnapshot(), []);
  const historyEntry = useMemo(
    () => (sessionId ? loadSessionHistoryEntry(sessionId) : null),
    [sessionId],
  );
  const [remoteHistoryEntry, setRemoteHistoryEntry] = useState(historyEntry);
  const activeSnapshot = useMemo(() => {
    if (remoteHistoryEntry) {
      return {
        completedAt: remoteHistoryEntry.completedAt,
        id: remoteHistoryEntry.id,
        payload: remoteHistoryEntry.payload,
      };
    }

    if (lastSessionSnapshot && (!sessionId || lastSessionSnapshot.id === sessionId)) {
      return lastSessionSnapshot;
    }

    return null;
  }, [lastSessionSnapshot, remoteHistoryEntry, sessionId]);
  const isCustomPractice =
    activeSnapshot?.payload.customPracticeSettings !== null &&
    activeSnapshot?.payload.customPracticeSettings !== undefined;
  const isDebateSession =
    activeSnapshot?.payload.mode === "debate" ||
    Boolean(activeSnapshot?.payload.debateSettings);
  const activeScenario = useMemo(
    () =>
      scenarios.find((scenario) => scenario.id === activeSnapshot?.payload.scenario.id) ??
      scenarios[0],
    [activeSnapshot],
  );
  const [resolvedSnapshot, setResolvedSnapshot] = useState(activeSnapshot);
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "loading" | "ready">(
    remoteHistoryEntry ? "ready" : "idle",
  );
  const [debateStatus, setDebateStatus] = useState<"idle" | "loading" | "ready">(
    remoteHistoryEntry?.payload.debateResult ? "ready" : "idle",
  );
  const [syncedSessionId, setSyncedSessionId] = useState<string | null>(null);
  const [presenceAnalysisStatus, setPresenceAnalysisStatus] = useState<
    "analyzing" | "complete" | "idle"
  >("idle");
  const [analysisRecordingBlob, setAnalysisRecordingBlob] = useState<Blob | null>(null);
  const [analysisRecordingStatus, setAnalysisRecordingStatus] = useState<
    "idle" | "loading" | "missing" | "ready"
  >("idle");
  const [analysisRecordingUrl, setAnalysisRecordingUrl] = useState<string | null>(null);

  useEffect(() => {
    setRemoteHistoryEntry(historyEntry);
    setSyncedSessionId(null);
  }, [historyEntry]);

  useEffect(() => {
    setResolvedSnapshot(activeSnapshot);
    setFeedbackStatus(remoteHistoryEntry ? "ready" : "idle");
    setDebateStatus(
      activeSnapshot?.payload.debateResult || !isDebateSession ? "ready" : "idle",
    );
    setPresenceAnalysisStatus(
      activeSnapshot?.payload.presence || !activeSnapshot?.payload.cameraRecording
        ? "complete"
        : activeSnapshot
          ? "idle"
          : "complete",
    );
  }, [activeSnapshot, isDebateSession, remoteHistoryEntry]);

  useEffect(() => {
    const recording = resolvedSnapshot?.payload.cameraRecording;

    if (!resolvedSnapshot || !recording) {
      setAnalysisRecordingBlob(null);
      setAnalysisRecordingStatus("idle");
      return undefined;
    }

    let cancelled = false;
    setAnalysisRecordingStatus("loading");

    void loadAnalysisRecordingBlob(resolvedSnapshot.id, recording)
      .then((recordingBlob) => {
        if (cancelled) {
          return;
        }

        setAnalysisRecordingBlob(recordingBlob);
        setAnalysisRecordingStatus(recordingBlob ? "ready" : "missing");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAnalysisRecordingBlob(null);
        setAnalysisRecordingStatus("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedSnapshot?.id, resolvedSnapshot?.payload.cameraRecording?.id]);

  useEffect(() => {
    if (!analysisRecordingBlob) {
      setAnalysisRecordingUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(analysisRecordingBlob);
    setAnalysisRecordingUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [analysisRecordingBlob]);

  useEffect(() => {
    if (!sessionId || historyEntry || lastSessionSnapshot?.id === sessionId) {
      return undefined;
    }

    let cancelled = false;

    void loadSessionSnapshotFromSupabase(sessionId).then((entry) => {
      if (cancelled || !entry) {
        return;
      }

      setRemoteHistoryEntry(entry);
      setFeedback(entry.feedback);
      setFeedbackStatus("ready");
      setDebateResult(entry.payload.debateResult ?? null);
      setDebateStatus(entry.payload.debateResult ? "ready" : "idle");
      setSyncedSessionId(null);
      upsertSessionHistoryEntry(entry);
      saveLastSessionSnapshot({
        completedAt: entry.completedAt,
        id: entry.id,
        payload: entry.payload,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [historyEntry, lastSessionSnapshot, sessionId]);

  const sessionPayload = useMemo(
    () => resolvedSnapshot?.payload ?? createMockSessionPayload(activeScenario),
    [activeScenario, resolvedSnapshot],
  );
  const deterministicFeedback = useMemo(
    () => buildDeterministicFeedbackSummary(sessionPayload),
    [sessionPayload],
  );
  const deterministicDebateResult = useMemo(
    () =>
      isDebateSession && sessionPayload.debateSettings
        ? buildDeterministicDebateResult(sessionPayload)
        : null,
    [isDebateSession, sessionPayload],
  );
  const presenceResult = sessionPayload.presence ?? null;
  const customPracticeQuestionSeeds = useMemo(
    () =>
      isCustomPractice
        ? buildCustomPracticeQuestionReviewSeeds(sessionPayload)
        : [],
    [isCustomPractice, sessionPayload],
  );
  const deterministicQuestionReviews = useMemo(
    () =>
      customPracticeQuestionSeeds.map((seed) =>
        buildQuestionReviewSummary(
          seed.payload,
          buildDeterministicFeedbackSummary(seed.payload),
          seed.payload.presence ?? null,
          seed.questionIndex,
        ),
      ),
    [customPracticeQuestionSeeds],
  );
  const [feedback, setFeedback] = useState(
    remoteHistoryEntry?.feedback ?? deterministicFeedback,
  );
  const [debateResult, setDebateResult] = useState<DebateResult | null>(
    remoteHistoryEntry?.payload.debateResult ?? deterministicDebateResult,
  );
  const [questionReviewStatus, setQuestionReviewStatus] = useState<
    "idle" | "loading" | "ready"
  >("ready");
  const [questionReviews, setQuestionReviews] = useState<CustomPracticeQuestionReview[]>(
    deterministicQuestionReviews,
  );
  const scoreCards = useMemo(
    () => [
      { label: "Clarity", value: feedback.scores.clarity },
      { label: "Confidence", value: feedback.scores.confidence },
      { label: "Pace", value: feedback.scores.pace },
      {
        label: "Eye Contact / Presence",
        value: feedback.scores.eyeContactPresence,
      },
    ],
    [feedback],
  );
  const insightCards = useMemo(
    () => [
      { body: feedback.bestMoment, title: "Best moment" },
      { body: feedback.improvementArea, title: "Improvement area" },
      { body: feedback.nextChallenge, title: "Next challenge" },
    ],
    [feedback],
  );

  useEffect(() => {
    setFeedback(remoteHistoryEntry?.feedback ?? deterministicFeedback);
  }, [deterministicFeedback, remoteHistoryEntry]);

  useEffect(() => {
    setDebateResult(remoteHistoryEntry?.payload.debateResult ?? deterministicDebateResult);
  }, [deterministicDebateResult, remoteHistoryEntry]);

  const hasSessionRecording = Boolean(resolvedSnapshot?.payload.cameraRecording);

  useEffect(() => {
    setQuestionReviews(deterministicQuestionReviews);
    setQuestionReviewStatus(
      isCustomPractice && deterministicQuestionReviews.length > 0 ? "idle" : "ready",
    );
  }, [deterministicQuestionReviews, isCustomPractice]);

  useEffect(() => {
    const snapshotForAnalysis = resolvedSnapshot;

    if (
      !snapshotForAnalysis ||
      snapshotForAnalysis.payload.presence ||
      !snapshotForAnalysis.payload.cameraRecording ||
      presenceAnalysisStatus === "analyzing" ||
      analysisRecordingStatus === "idle" ||
      analysisRecordingStatus === "loading"
    ) {
      return undefined;
    }

    if (analysisRecordingStatus === "missing" || !analysisRecordingBlob) {
      const nextSnapshot = {
        ...snapshotForAnalysis,
        payload: {
          ...snapshotForAnalysis.payload,
          presence: createUnavailablePresenceResult("recording_missing"),
        },
      };

      setResolvedSnapshot(nextSnapshot);
      saveLastSessionSnapshot(nextSnapshot);
      setPresenceAnalysisStatus("complete");
      return undefined;
    }

    let cancelled = false;
    setPresenceAnalysisStatus("analyzing");

    void analyzeSessionRecording(
      analysisRecordingBlob,
      snapshotForAnalysis.payload.transcript,
    )
      .then((presence) => {
        if (cancelled) {
          return;
        }

        const nextSnapshot = {
          ...snapshotForAnalysis,
          payload: {
            ...snapshotForAnalysis.payload,
            presence,
          },
        };

        setResolvedSnapshot(nextSnapshot);
        saveLastSessionSnapshot(nextSnapshot);
        setPresenceAnalysisStatus("complete");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const nextSnapshot = {
          ...snapshotForAnalysis,
          payload: {
            ...snapshotForAnalysis.payload,
            presence: createUnavailablePresenceResult("analysis_failed"),
          },
        };

        setResolvedSnapshot(nextSnapshot);
        saveLastSessionSnapshot(nextSnapshot);
        setPresenceAnalysisStatus("complete");
      });

    return () => {
      cancelled = true;
    };
  }, [
    analysisRecordingBlob,
    analysisRecordingStatus,
    presenceAnalysisStatus,
    resolvedSnapshot,
  ]);

  const shouldRefreshFeedback = useMemo(() => {
    if (!resolvedSnapshot) {
      return false;
    }

    const isAwaitingPresenceAnalysis =
      Boolean(resolvedSnapshot.payload.cameraRecording) &&
      !resolvedSnapshot.payload.presence &&
      presenceAnalysisStatus !== "complete";

    if (isAwaitingPresenceAnalysis) {
      return false;
    }

    if (presenceAnalysisStatus === "analyzing") {
      return false;
    }

    if (!remoteHistoryEntry) {
      return true;
    }

    return !hasMatchingPresence(
      remoteHistoryEntry.payload.presence,
      resolvedSnapshot.payload.presence,
    );
  }, [presenceAnalysisStatus, remoteHistoryEntry, resolvedSnapshot]);

  const shouldRefreshDebate = useMemo(() => {
    if (!resolvedSnapshot || !isDebateSession || !resolvedSnapshot.payload.debateSettings) {
      return false;
    }

    if (debateStatus === "loading") {
      return false;
    }

    const isAwaitingPresenceAnalysis =
      Boolean(resolvedSnapshot.payload.cameraRecording) &&
      !resolvedSnapshot.payload.presence &&
      presenceAnalysisStatus !== "complete";

    if (isAwaitingPresenceAnalysis || presenceAnalysisStatus === "analyzing") {
      return false;
    }

    if (!remoteHistoryEntry?.payload.debateResult) {
      return true;
    }

    return !hasMatchingPresence(
      remoteHistoryEntry.payload.presence,
      resolvedSnapshot.payload.presence,
    );
  }, [
    debateStatus,
    isDebateSession,
    presenceAnalysisStatus,
    remoteHistoryEntry,
    resolvedSnapshot,
  ]);

  useEffect(() => {
    if (!resolvedSnapshot || !shouldRefreshFeedback) {
      return undefined;
    }

    let cancelled = false;
    setFeedbackStatus("loading");
    upsertSessionHistoryEntry(buildSessionHistoryEntry(resolvedSnapshot));

    void requestSessionFeedback(resolvedSnapshot.payload).then((summary) => {
      if (cancelled) {
        return;
      }

      setFeedback(summary);
      setFeedbackStatus("ready");
      const nextEntry = buildSessionHistoryEntry(resolvedSnapshot, summary);
      setRemoteHistoryEntry(nextEntry);
      upsertSessionHistoryEntry(nextEntry);
    });

    return () => {
      cancelled = true;
    };
  }, [resolvedSnapshot, shouldRefreshFeedback]);

  useEffect(() => {
    if (
      !resolvedSnapshot ||
      !resolvedSnapshot.payload.debateSettings ||
      !shouldRefreshDebate ||
      !deterministicDebateResult
    ) {
      return undefined;
    }

    let cancelled = false;
    setDebateStatus("loading");

    const seededSnapshot = {
      ...resolvedSnapshot,
      payload: {
        ...resolvedSnapshot.payload,
        debateResult: deterministicDebateResult,
      },
    };

    setResolvedSnapshot(seededSnapshot);
    saveLastSessionSnapshot(seededSnapshot);

    void requestDebateJudgment(seededSnapshot.payload).then((summary) => {
      if (cancelled) {
        return;
      }

      setDebateResult(summary);
      setDebateStatus("ready");
      const nextSnapshot = {
        ...seededSnapshot,
        payload: {
          ...seededSnapshot.payload,
          debateResult: summary,
        },
      };

      setResolvedSnapshot(nextSnapshot);
      saveLastSessionSnapshot(nextSnapshot);
      setSyncedSessionId(null);
      const nextEntry = buildSessionHistoryEntry(nextSnapshot, feedback);
      setRemoteHistoryEntry(nextEntry);
      upsertSessionHistoryEntry(nextEntry);
    });

    return () => {
      cancelled = true;
    };
  }, [
    deterministicDebateResult,
    feedback,
    resolvedSnapshot,
    shouldRefreshDebate,
  ]);

  useEffect(() => {
    if (
      !isCustomPractice ||
      !resolvedSnapshot ||
      customPracticeQuestionSeeds.length === 0 ||
      presenceAnalysisStatus === "analyzing"
    ) {
      return undefined;
    }

    let cancelled = false;
    setQuestionReviewStatus("loading");

    void (async () => {
      const recordingBlob = await loadAnalysisRecordingBlob(
        resolvedSnapshot.id,
        resolvedSnapshot.payload.cameraRecording,
      );
      const nextReviews: CustomPracticeQuestionReview[] = [];

      for (const seed of customPracticeQuestionSeeds) {
        if (cancelled) {
          return;
        }

        const questionPresence =
          recordingBlob &&
          seed.sessionStartTimestamp !== null &&
          seed.windowStartTimestamp !== null &&
          seed.windowEndTimestamp !== null
            ? await analyzeSessionRecording(recordingBlob, seed.payload.transcript, {
                analysisEndTimestamp: seed.windowEndTimestamp,
                analysisStartTimestamp: seed.windowStartTimestamp,
                sessionStartTimestamp: seed.sessionStartTimestamp,
              })
            : resolvedSnapshot.payload.presence ?? null;

        if (cancelled) {
          return;
        }

        const feedback = await requestSessionFeedback({
          ...seed.payload,
          presence: questionPresence,
        });

        if (cancelled) {
          return;
        }

        nextReviews.push(
          buildQuestionReviewSummary(
            seed.payload,
            feedback,
            questionPresence,
            seed.questionIndex,
          ),
        );
        setQuestionReviews([...nextReviews, ...deterministicQuestionReviews.slice(nextReviews.length)]);
      }

      setQuestionReviewStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [
    customPracticeQuestionSeeds,
    deterministicQuestionReviews,
    isCustomPractice,
    presenceAnalysisStatus,
    resolvedSnapshot,
  ]);

  useEffect(() => {
    if (
      !resolvedSnapshot ||
      presenceAnalysisStatus !== "complete" ||
      feedbackStatus !== "ready" ||
      (isDebateSession && debateStatus !== "ready") ||
      syncedSessionId === resolvedSnapshot.id
    ) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      try {
        const recordingBlob = resolvedSnapshot.payload.cameraRecording
          ? await loadLocalSessionRecordingBlob(resolvedSnapshot.payload.cameraRecording.id)
          : null;
        const synced = await syncSessionToSupabase({
          feedback,
          recordingBlob,
          snapshot: resolvedSnapshot,
        });

        if (cancelled || !synced) {
          if (!cancelled) {
            setSyncedSessionId(resolvedSnapshot.id);
          }
          return;
        }

        const remoteEntries = await loadSessionHistoryFromSupabase();

        if (cancelled) {
          return;
        }

        const matchingEntry =
          remoteEntries.find((entry) => entry.id === resolvedSnapshot.id) ?? null;

        if (matchingEntry) {
          setRemoteHistoryEntry(matchingEntry);
          setSyncedSessionId(matchingEntry.id);
          upsertSessionHistoryEntry(matchingEntry);
        }
      } catch (error) {
        console.warn("[voiceforge] Supabase session sync skipped:", error);
        if (!cancelled) {
          setSyncedSessionId(resolvedSnapshot.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    debateStatus,
    feedback,
    feedbackStatus,
    isDebateSession,
    presenceAnalysisStatus,
    resolvedSnapshot,
    syncedSessionId,
  ]);

  if (isDebateSession && sessionPayload.debateSettings && debateResult) {
    return (
      <AppShell>
        <DebateResultsView
          analysisRecordingStatus={analysisRecordingStatus}
          analysisRecordingUrl={analysisRecordingUrl}
          debateResult={debateResult}
          feedback={feedback}
          feedbackStatus={feedbackStatus}
          hasSessionRecording={hasSessionRecording}
          presenceAnalysisStatus={presenceAnalysisStatus}
          presenceResult={presenceResult}
          settings={sessionPayload.debateSettings}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <PageIntro
          description={feedback.coachSummary}
          eyebrow="Session Results"
          title={getResultsTitle(feedback)}
          actions={
            <>
              {isCustomPractice ? (
                <Button size="lg" to="/practice/custom" variant="secondary">
                  <RotateCcw className="h-4 w-4" />
                  Rebuild custom drill
                </Button>
              ) : (
                <Button
                  size="lg"
                  to={`/session/${activeScenario.id}`}
                  variant="secondary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </Button>
              )}
              <Button size="lg" to={isCustomPractice ? "/dashboard" : "/scenarios"}>
                {isCustomPractice ? "Dashboard" : "Another scenario"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {scoreCards.map((score) => (
            <Panel key={score.label} className="p-5" elevated>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  {score.label}
                </p>
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-4 text-3xl font-semibold">{score.value}%</p>
              <div className="mt-4">
                <ProgressBar value={score.value} />
              </div>
            </Panel>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            {insightCards.map((insight) => (
              <Panel key={insight.title} className="p-6" elevated>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  {insight.title}
                </p>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  {insight.body}
                </p>
              </Panel>
            ))}
          </div>

          <div className="space-y-6">
            <Panel className="p-6" elevated>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Eye Contact / Presence
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {getPresenceHeadline(
                      presenceResult,
                      presenceAnalysisStatus,
                      hasSessionRecording,
                    )}
                  </h2>
                </div>
                {(presenceAnalysisStatus === "analyzing" && hasSessionRecording) ||
                feedbackStatus === "loading" ? (
                  <div className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary">
                    {presenceAnalysisStatus === "analyzing"
                      ? "MediaPipe analyzing video"
                      : "Refreshing coach feedback"}
                  </div>
                ) : (
                  presenceResult?.status === "ready" &&
                  presenceResult.nonVerbalScore !== null && (
                    <div className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary">
                      Post-session video summary
                    </div>
                  )
                )}
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                {presenceAnalysisStatus === "analyzing"
                  ? "Playing the saved session video while MediaPipe extracts presence signals and Groq refreshes the coaching feedback."
                  : formatPresenceCapture(presenceResult)}
              </p>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-3xl border border-border bg-shell p-3">
                  {analysisRecordingUrl ? (
                    <video
                      className="aspect-video w-full rounded-2xl bg-black object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      src={analysisRecordingUrl}
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border bg-panel px-6 text-center text-sm text-muted-foreground">
                      {analysisRecordingStatus === "loading"
                        ? "Loading the saved session video..."
                        : "The saved session video is unavailable for playback."}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-4 px-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    <span>Session recording</span>
                    <span>
                      {analysisRecordingStatus === "ready"
                        ? "Ready to review"
                        : analysisRecordingStatus === "loading"
                          ? "Loading"
                          : "Unavailable"}
                    </span>
                  </div>
                </div>

                <div className="space-y-5">
                  {presenceAnalysisStatus === "analyzing" ? (
                    <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">
                          Processing the saved camera recording now. The final Eye Contact /
                          Presence score and Groq coaching summary will update when analysis completes.
                        </p>
                      </div>
                    </div>
                  ) : presenceResult?.status === "ready" ? (
                    <>
                      {[
                        {
                          label: "Face presence",
                          value: presenceResult.summary.facePresencePct,
                        },
                        {
                          label: "Forward attention",
                          value: presenceResult.summary.forwardAttentionPct,
                        },
                        {
                          label: "Head stability",
                          value: presenceResult.summary.headStabilityPct,
                        },
                        {
                          label: "Speaking mouth activity",
                          value: presenceResult.summary.speakingMouthActivityPct,
                        },
                      ].map((metric) => (
                        <div key={metric.label} className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>{metric.label}</span>
                            <span className="font-medium">{metric.value}%</span>
                          </div>
                          <ProgressBar value={metric.value} />
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-border bg-shell px-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        {analysisRecordingStatus === "missing"
                          ? "The recorded session video could not be loaded for playback or MediaPipe analysis."
                          : "Presence scoring only runs when a browser camera recording is available."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                {NON_VERBAL_HEURISTIC_NOTE} {NON_VERBAL_WEIGHT_NOTE}
              </p>
            </Panel>

            <Panel className="p-6" elevated>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Transcript summary
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Session highlights</h2>
              </div>

              <div className="mt-6 space-y-4">
                {feedback.highlights.map((highlight) => (
                  <div
                    key={`${highlight.label}-${highlight.timestamp}`}
                    className="rounded-2xl border border-border bg-shell p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium">{highlight.label}</p>
                      <span className="font-mono text-sm text-muted-foreground">
                        {highlight.timestamp}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {highlight.quote}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                {formatFillerBreakdown(feedback)}
              </p>
            </Panel>
          </div>
        </div>

        {isCustomPractice && questionReviews.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                  Question Review
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Feedback for each answer
                </h2>
              </div>
              <div className="rounded-full border border-border bg-shell px-4 py-2 text-sm text-muted-foreground">
                {questionReviewStatus === "loading"
                  ? "Building question-by-question feedback"
                  : `${questionReviews.length} questions reviewed`}
              </div>
            </div>

            {questionReviews.map((review) => (
              <Panel
                key={`${review.questionIndex}-${review.promptText}`}
                className="p-6"
                elevated
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                      Question {review.questionIndex + 1}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold leading-tight">
                      {review.promptText}
                    </h3>
                  </div>
                  <div className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary">
                    {review.presence?.status === "ready" &&
                    review.presence.nonVerbalScore !== null
                      ? `${review.presence.nonVerbalScore}% camera presence`
                      : "Camera score unavailable"}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Clarity", value: review.feedback.scores.clarity },
                    { label: "Confidence", value: review.feedback.scores.confidence },
                    { label: "Pace", value: review.feedback.scores.pace },
                    {
                      label: "Eye Contact / Presence",
                      value: review.feedback.scores.eyeContactPresence,
                    },
                  ].map((score) => (
                    <div
                      key={score.label}
                      className="rounded-2xl border border-border bg-shell px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          {score.label}
                        </p>
                        <span className="text-sm font-medium">{score.value}%</span>
                      </div>
                      <div className="mt-4">
                        <ProgressBar value={score.value} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {[
                    {
                      body: review.feedback.bestMoment,
                      title: "Best moment",
                    },
                    {
                      body: review.feedback.improvementArea,
                      title: "Improvement area",
                    },
                    {
                      body: review.feedback.nextChallenge,
                      title: "Next challenge",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-border bg-shell px-4 py-4"
                    >
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {item.title}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-foreground">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-shell px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Your answer
                  </p>
                  <p className="mt-3 text-sm leading-7 text-foreground">
                    {review.answerText || "No spoken response was captured for this prompt."}
                  </p>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
