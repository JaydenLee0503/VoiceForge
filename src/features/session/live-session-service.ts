import {
  Conversation,
  type DisconnectionDetails,
  type Mode,
  type Status,
} from "@elevenlabs/client";

import { liveTranscriptSeed } from "@/shared/data/mock";
import type { SessionAnalysisScenario, SessionTranscriptRole } from "../../../lib/voice-feedback/contracts";

const SIGNED_URL_ENDPOINT = "/api/elevenlabs/signed-url";

type SignedUrlResponse =
  | {
      mode: "elevenlabs";
      signedUrl: string;
    }
  | {
      mode: "mock";
      reason: "endpoint_unavailable" | "missing_credentials";
    }
  | {
      message: string;
      mode: "error";
    };

export type LiveSessionTransport = "elevenlabs" | "mock";

export type LiveTranscriptEntry = {
  id: string;
  role: SessionTranscriptRole;
  text: string;
  timestamp: number;
};

type ConversationMessagePayload = {
  event_id?: number;
  message: string;
  role: "agent" | "user";
};

type LiveSessionCallbacks = {
  onAudioChunk?: () => void;
  onConnect?: (conversationId: string) => void;
  onDisconnect?: (details: DisconnectionDetails) => void;
  onError?: (message: string) => void;
  onMessage?: (entry: LiveTranscriptEntry) => void;
  onModeChange?: (mode: Mode) => void;
  onResolvedMode?: (
    mode: LiveSessionTransport,
    notice?: string,
  ) => void;
  onStatusChange?: (status: Status) => void;
};

type StartLiveSessionOptions = {
  callbacks: LiveSessionCallbacks;
  muted: boolean;
  session: LiveSessionConfig;
};

export type LiveSessionController = {
  end: () => Promise<void>;
  mode: LiveSessionTransport;
  sendContextualUpdate: (context: string) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
};

export type LiveSessionConfig = {
  agentRole?: Extract<SessionTranscriptRole, "coach" | "opponent">;
  contextualInstructions?: string;
  dynamicVariables?: Record<string, string>;
  mockTranscript?: LiveTranscriptEntry[];
  persona?: "coach" | "debate";
  scenario: SessionAnalysisScenario;
  signedUrlMode?: "coach" | "debate";
};

function createTranscriptEntry(
  message: ConversationMessagePayload,
  agentRole: Extract<SessionTranscriptRole, "coach" | "opponent">,
): LiveTranscriptEntry {
  return {
    id:
      typeof message.event_id === "number"
        ? `evt-${message.event_id}`
        : `evt-${crypto.randomUUID()}`,
    role: message.role === "agent" ? agentRole : "user",
    text: message.message,
    timestamp: Date.now(),
  };
}

function getMockNotice(reason: "endpoint_unavailable" | "missing_credentials") {
  if (reason === "missing_credentials") {
    return "ElevenLabs credentials are not configured. Running the live page in mock mode.";
  }

  return "The local signed URL endpoint is unavailable. Running the live page in mock mode.";
}

function getDebateFallbackError(reason: "endpoint_unavailable" | "missing_credentials") {
  if (reason === "missing_credentials") {
    return "Debate mode requires ELEVENLABS_API_KEY and ELEVENLABS_DEBATE_AGENT_ID. Mock fallback is disabled.";
  }

  return "Debate mode requires the local ElevenLabs signed URL endpoint. Mock fallback is disabled.";
}

async function getSignedUrlResponse(
  mode: LiveSessionConfig["signedUrlMode"] = "coach",
): Promise<SignedUrlResponse> {
  try {
    const requestUrl = new URL(SIGNED_URL_ENDPOINT, window.location.origin);
    requestUrl.searchParams.set("mode", mode);
    const response = await fetch(requestUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      return {
        mode: "mock",
        reason: "endpoint_unavailable",
      };
    }

    const body = (await response.json()) as SignedUrlResponse;

    if (!response.ok) {
      if (body.mode === "error") {
        throw new Error(body.message);
      }

      throw new Error("Failed to retrieve a signed URL for ElevenLabs.");
    }

    return body;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "SyntaxError") {
        return {
          mode: "mock",
          reason: "endpoint_unavailable",
        };
      }

      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        return {
          mode: "mock",
          reason: "endpoint_unavailable",
        };
      }
    }

    throw error;
  }
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Microphone access is unavailable in this browser context. Use HTTPS or localhost.",
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError") {
        throw new Error("Microphone access was blocked. Allow the mic to start a live session.");
      }

      if (error.name === "NotFoundError") {
        throw new Error("No microphone was found for this device.");
      }
    }

    throw new Error("Microphone access is required to start the live session.");
  }
}

function buildScenarioContext(scenario: SessionAnalysisScenario) {
  return [
    "VoiceForge scenario selected.",
    `Scenario ID: ${scenario.id}.`,
    `Title: ${scenario.title}.`,
    `Focus: ${scenario.focus}.`,
    `Description: ${scenario.description}.`,
    "Coach the user with short, practical speaking feedback while keeping the conversation natural.",
  ].join(" ");
}

function buildSessionContext(session: LiveSessionConfig) {
  return session.contextualInstructions ?? buildScenarioContext(session.scenario);
}

function startMockSession({
  callbacks,
  session,
}: Omit<StartLiveSessionOptions, "muted">): LiveSessionController {
  const conversationId = `mock-${Date.now().toString(36)}`;
  const mockTranscript = session.mockTranscript ?? liveTranscriptSeed;
  const timeouts = new Set<number>();
  let ended = false;

  const schedule = (callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      timeouts.delete(timeoutId);
      callback();
    }, delayMs);

    timeouts.add(timeoutId);
  };

  const clearScheduledWork = () => {
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeouts.clear();
  };

  const emitTranscript = (index: number) => {
    if (ended || index >= mockTranscript.length) {
      callbacks.onModeChange?.("listening");
      return;
    }

    const entry = mockTranscript[index];
    callbacks.onModeChange?.(entry.role === "user" ? "listening" : "speaking");

    if (entry.role !== "user") {
      callbacks.onAudioChunk?.();
    }

    callbacks.onMessage?.({
      id: `mock-${index}`,
      role: entry.role,
      text: entry.text,
      timestamp: Date.now(),
    });

    schedule(() => emitTranscript(index + 1), index === 0 ? 1800 : 2400);
  };

  callbacks.onStatusChange?.("connecting");

  schedule(() => {
    if (ended) {
      return;
    }

    callbacks.onConnect?.(conversationId);
    callbacks.onStatusChange?.("connected");
    emitTranscript(0);
  }, 650);

  return {
    end: async () => {
      if (ended) {
        return;
      }

      ended = true;
      clearScheduledWork();
      callbacks.onStatusChange?.("disconnecting");
      callbacks.onStatusChange?.("disconnected");
      callbacks.onDisconnect?.({ reason: "user" });
    },
    mode: "mock",
    sendContextualUpdate: async () => {},
    setMuted: async () => {},
  };
}

export async function startLiveSession({
  callbacks,
  muted,
  session,
}: StartLiveSessionOptions): Promise<LiveSessionController> {
  const signedUrlResponse = await getSignedUrlResponse(session.signedUrlMode);

  if (signedUrlResponse.mode === "mock") {
    if (session.signedUrlMode === "debate") {
      throw new Error(getDebateFallbackError(signedUrlResponse.reason));
    }

    callbacks.onResolvedMode?.(
      "mock",
      getMockNotice(signedUrlResponse.reason),
    );

    return startMockSession({ callbacks, session });
  }

  if (signedUrlResponse.mode === "error") {
    throw new Error(signedUrlResponse.message);
  }

  callbacks.onResolvedMode?.("elevenlabs");
  await ensureMicrophoneAccess();
  const agentRole = session.agentRole ?? "coach";

  const conversation = await Conversation.startSession({
    connectionType: "websocket",
    dynamicVariables: session.dynamicVariables,
    onAudio: () => {
      callbacks.onAudioChunk?.();
    },
    onConnect: ({ conversationId }) => {
      callbacks.onConnect?.(conversationId);
    },
    onDisconnect: (details) => {
      callbacks.onDisconnect?.(details);
    },
    onError: (message) => {
      callbacks.onError?.(message);
    },
    onMessage: (message) => {
      callbacks.onMessage?.(createTranscriptEntry(message, agentRole));
    },
    onModeChange: ({ mode }) => {
      callbacks.onModeChange?.(mode);
    },
    onStatusChange: ({ status }) => {
      callbacks.onStatusChange?.(status);
    },
    signedUrl: signedUrlResponse.signedUrl,
  });

  conversation.setMicMuted(muted);
  conversation.sendContextualUpdate(buildSessionContext(session));

  return {
    end: async () => {
      await conversation.endSession();
    },
    mode: "elevenlabs",
    sendContextualUpdate: async (context) => {
      conversation.sendContextualUpdate(context);
    },
    setMuted: async (nextMuted) => {
      conversation.setMicMuted(nextMuted);
    },
  };
}
