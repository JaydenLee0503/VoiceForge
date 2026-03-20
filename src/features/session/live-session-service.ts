import {
  Conversation,
  type DisconnectionDetails,
  type Mode,
  type Status,
} from "@elevenlabs/client";

import { liveTranscriptSeed, type Scenario } from "@/shared/data/mock";

const SIGNED_URL_ENDPOINT = "/api/elevenlabs/signed-url";

type SessionScenarioContext = Pick<
  Scenario,
  "description" | "focus" | "id" | "title"
>;

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
  role: "coach" | "user";
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
  scenario: SessionScenarioContext;
};

export type LiveSessionController = {
  end: () => Promise<void>;
  mode: LiveSessionTransport;
  setMuted: (muted: boolean) => Promise<void>;
};

function createTranscriptEntry(
  message: ConversationMessagePayload,
): LiveTranscriptEntry {
  return {
    id:
      typeof message.event_id === "number"
        ? `evt-${message.event_id}`
        : `evt-${crypto.randomUUID()}`,
    role: message.role === "agent" ? "coach" : "user",
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

async function getSignedUrlResponse(): Promise<SignedUrlResponse> {
  try {
    const response = await fetch(SIGNED_URL_ENDPOINT, {
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

function buildScenarioContext(scenario: SessionScenarioContext) {
  return [
    "VoiceForge scenario selected.",
    `Scenario ID: ${scenario.id}.`,
    `Title: ${scenario.title}.`,
    `Focus: ${scenario.focus}.`,
    `Description: ${scenario.description}.`,
    "Coach the user with short, practical speaking feedback while keeping the conversation natural.",
  ].join(" ");
}

function startMockSession({
  callbacks,
}: Omit<StartLiveSessionOptions, "muted" | "scenario">): LiveSessionController {
  const conversationId = `mock-${Date.now().toString(36)}`;
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
    if (ended || index >= liveTranscriptSeed.length) {
      callbacks.onModeChange?.("listening");
      return;
    }

    const entry = liveTranscriptSeed[index];
    callbacks.onModeChange?.(entry.role === "coach" ? "speaking" : "listening");

    if (entry.role === "coach") {
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
    setMuted: async () => {},
  };
}

export async function startLiveSession({
  callbacks,
  muted,
  scenario,
}: StartLiveSessionOptions): Promise<LiveSessionController> {
  const signedUrlResponse = await getSignedUrlResponse();

  if (signedUrlResponse.mode === "mock") {
    callbacks.onResolvedMode?.(
      "mock",
      getMockNotice(signedUrlResponse.reason),
    );

    return startMockSession({ callbacks });
  }

  if (signedUrlResponse.mode === "error") {
    throw new Error(signedUrlResponse.message);
  }

  callbacks.onResolvedMode?.("elevenlabs");
  await ensureMicrophoneAccess();

  const conversation = await Conversation.startSession({
    connectionType: "websocket",
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
      callbacks.onMessage?.(createTranscriptEntry(message));
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
  conversation.sendContextualUpdate(buildScenarioContext(scenario));

  return {
    end: async () => {
      await conversation.endSession();
    },
    mode: "elevenlabs",
    setMuted: async (nextMuted) => {
      conversation.setMicMuted(nextMuted);
    },
  };
}
