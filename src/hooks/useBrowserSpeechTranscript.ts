import { useEffect, useMemo, useRef, useState } from "react";

import type { SessionTranscriptEntry } from "../../lib/voice-feedback/contracts";

type RecognitionStatus =
  | "error"
  | "idle"
  | "listening"
  | "starting"
  | "unsupported";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type UseBrowserSpeechTranscriptOptions = {
  enabled: boolean;
  isCapturing: boolean;
  sessionId: string | null;
};

type UseBrowserSpeechTranscriptResult = {
  interimText: string;
  status: RecognitionStatus;
  statusMessage: string;
  transcript: SessionTranscriptEntry[];
  transcriptSupported: boolean;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function getRecognitionCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useBrowserSpeechTranscript({
  enabled,
  isCapturing,
  sessionId,
}: UseBrowserSpeechTranscriptOptions): UseBrowserSpeechTranscriptResult {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldCaptureRef = useRef(false);
  const processedResultIndexRef = useRef(0);
  const sessionIdRef = useRef<string | null>(sessionId);
  const restartTimeoutRef = useRef<number | null>(null);

  const [interimText, setInterimText] = useState("");
  const [status, setStatus] = useState<RecognitionStatus>(() =>
    getRecognitionCtor() ? "idle" : "unsupported",
  );
  const [transcript, setTranscript] = useState<SessionTranscriptEntry[]>([]);

  useEffect(() => {
    if (sessionId !== sessionIdRef.current) {
      sessionIdRef.current = sessionId;
      processedResultIndexRef.current = 0;
      setInterimText("");
      setTranscript([]);
      setStatus(getRecognitionCtor() ? "idle" : "unsupported");
    }
  }, [sessionId]);

  useEffect(() => {
    shouldCaptureRef.current = enabled && isCapturing;
  }, [enabled, isCapturing]);

  useEffect(() => {
    const RecognitionCtor = getRecognitionCtor();

    if (!RecognitionCtor) {
      setStatus("unsupported");
      return undefined;
    }

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const nextEntries: SessionTranscriptEntry[] = [];
      let nextInterim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcriptText = result[0]?.transcript?.trim();

        if (!transcriptText) {
          continue;
        }

        if (result.isFinal && index >= processedResultIndexRef.current) {
          nextEntries.push({
            id: `${sessionIdRef.current ?? "speech"}-${Date.now()}-${index}`,
            role: "user",
            text: transcriptText,
            timestamp: Date.now(),
          });
          processedResultIndexRef.current = index + 1;
          nextInterim = "";
        } else if (!result.isFinal) {
          nextInterim = transcriptText;
        }
      }

      if (nextEntries.length > 0) {
        setTranscript((current) => [...current, ...nextEntries]);
      }

      setInterimText(nextInterim);
      setStatus("listening");
    };

    recognition.onerror = () => {
      setStatus("error");
    };

    recognition.onend = () => {
      if (!shouldCaptureRef.current) {
        setStatus("idle");
        return;
      }

      setStatus("starting");
      restartTimeoutRef.current = window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          setStatus("error");
        }
      }, 250);
    };

    recognitionRef.current = recognition;

    return () => {
      if (restartTimeoutRef.current !== null) {
        window.clearTimeout(restartTimeoutRef.current);
      }

      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const recognition = recognitionRef.current;

    if (!recognition || status === "unsupported") {
      return undefined;
    }

    if (!enabled || !isCapturing) {
      setInterimText("");

      if (status === "listening" || status === "starting") {
        recognition.stop();
      }

      if (status !== "error") {
        setStatus("idle");
      }

      return undefined;
    }

    if (status === "idle" || status === "error") {
      setStatus("starting");

      try {
        recognition.start();
      } catch {
        setStatus("error");
      }
    }

    return undefined;
  }, [enabled, isCapturing, status]);

  const statusMessage = useMemo(() => {
    switch (status) {
      case "listening":
        return "Listening for browser speech transcript.";
      case "starting":
        return "Starting browser speech transcript.";
      case "error":
        return "Speech transcript is tentative and may be incomplete in this browser.";
      case "unsupported":
        return "Browser speech transcript is unavailable here.";
      case "idle":
      default:
        return "Transcript capture starts during response time.";
    }
  }, [status]);

  return {
    interimText,
    status,
    statusMessage,
    transcript,
    transcriptSupported: status !== "unsupported",
  };
}
