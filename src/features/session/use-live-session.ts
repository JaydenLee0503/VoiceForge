import type { DisconnectionDetails, Mode, Status } from "@elevenlabs/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Scenario } from "@/shared/data/mock";

import {
  type LiveSessionController,
  type LiveSessionTransport,
  type LiveTranscriptEntry,
  startLiveSession,
} from "./live-session-service";

type SessionStatus = Status | "idle";

function appendTranscriptEntry(
  currentTranscript: LiveTranscriptEntry[],
  nextEntry: LiveTranscriptEntry,
) {
  const previousEntry = currentTranscript[currentTranscript.length - 1];

  if (
    previousEntry &&
    previousEntry.role === nextEntry.role &&
    previousEntry.text === nextEntry.text
  ) {
    return currentTranscript;
  }

  return [...currentTranscript, nextEntry];
}

function formatDisconnectMessage(details: DisconnectionDetails) {
  if (details.reason === "user") {
    return "Session ended.";
  }

  if (details.reason === "agent") {
    return details.closeReason
      ? `Coach disconnected: ${details.closeReason}`
      : "Coach disconnected.";
  }

  return details.message;
}

export function useLiveSession() {
  const controllerRef = useRef<LiveSessionController | null>(null);
  const mutedRef = useRef(false);
  const sessionRunRef = useRef(0);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAudioStream, setHasAudioStream] = useState(false);
  const [mode, setMode] = useState<LiveSessionTransport | null>(null);
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [speakerMode, setSpeakerMode] = useState<Mode>("listening");
  const [transcript, setTranscript] = useState<LiveTranscriptEntry[]>([]);

  const applyMuted = useCallback(async (nextMuted: boolean) => {
    mutedRef.current = nextMuted;
    setMuted(nextMuted);

    if (!controllerRef.current) {
      return;
    }

    try {
      await controllerRef.current.setMuted(nextMuted);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Failed to update microphone mute state.";

      setError(message);
    }
  }, []);

  const toggleMuted = useCallback(() => {
    void applyMuted(!mutedRef.current);
  }, [applyMuted]);

  const startSession = useCallback(
    async (scenario: Scenario) => {
      if (
        sessionStatus === "connecting" ||
        sessionStatus === "connected" ||
        sessionStatus === "disconnecting"
      ) {
        return;
      }

      const runId = sessionRunRef.current + 1;
      sessionRunRef.current = runId;
      setConversationId(null);
      setDisconnectMessage(null);
      setError(null);
      setHasAudioStream(false);
      setMode(null);
      setNotice(null);
      setSessionStatus("connecting");
      setSpeakerMode("listening");
      setTranscript([]);

      try {
        const controller = await startLiveSession({
          callbacks: {
            onAudioChunk: () => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              setHasAudioStream(true);
            },
            onConnect: (nextConversationId) => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              setConversationId(nextConversationId);
            },
            onDisconnect: (details) => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              controllerRef.current = null;
              setConversationId(null);
              setDisconnectMessage(formatDisconnectMessage(details));
              setSessionStatus("disconnected");
              setSpeakerMode("listening");
            },
            onError: (message) => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              setError(message);
            },
            onMessage: (entry) => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              setTranscript((currentTranscript) =>
                appendTranscriptEntry(currentTranscript, entry),
              );
            },
            onModeChange: (nextSpeakerMode) => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              setSpeakerMode(nextSpeakerMode);
            },
            onResolvedMode: (nextMode, nextNotice) => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              setMode(nextMode);
              setNotice(nextNotice ?? null);
            },
            onStatusChange: (nextStatus) => {
              if (sessionRunRef.current !== runId) {
                return;
              }

              setSessionStatus(nextStatus);
            },
          },
          muted: mutedRef.current,
          scenario,
        });

        if (sessionRunRef.current !== runId) {
          await controller.end();
          return;
        }

        controllerRef.current = controller;
        setMode(controller.mode);
        await controller.setMuted(mutedRef.current);
      } catch (startError) {
        controllerRef.current = null;
        setSessionStatus("disconnected");
        setSpeakerMode("listening");
        setError(
          startError instanceof Error
            ? startError.message
            : "Failed to start the live session.",
        );
      }
    },
    [sessionStatus],
  );

  const endSession = useCallback(async () => {
    const controller = controllerRef.current;

    if (!controller) {
      setSessionStatus("disconnected");
      return;
    }

    setSessionStatus("disconnecting");

    try {
      await controller.end();
    } catch (endError) {
      setError(
        endError instanceof Error
          ? endError.message
          : "Failed to end the live session cleanly.",
      );
      setSessionStatus("disconnected");
    } finally {
      controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      const activeController = controllerRef.current;
      controllerRef.current = null;

      if (!activeController) {
        return;
      }

      void activeController.end();
    };
  }, []);

  const isSessionActive = useMemo(
    () =>
      sessionStatus === "connecting" ||
      sessionStatus === "connected" ||
      sessionStatus === "disconnecting",
    [sessionStatus],
  );

  return {
    conversationId,
    disconnectMessage,
    endSession,
    error,
    hasAudioStream,
    isSessionActive,
    mode,
    muted,
    notice,
    sessionStatus,
    speakerMode,
    startSession,
    toggleMuted,
    transcript,
  };
}
