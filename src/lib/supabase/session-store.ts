import type {
  StoredSessionHistoryEntry,
  StoredSessionSnapshot,
} from "@/features/session/session-storage";
import { buildDisplayTranscript, buildRawTranscript } from "@/lib/transcript/formatting";
import {
  buildDeterministicFeedbackSummary,
  buildVerbalMetricsSummary,
} from "../../../lib/voice-feedback/analysis";
import type {
  FeedbackSummary,
  SessionAnalysisPayload,
  SessionCameraRecording,
} from "../../../lib/voice-feedback/contracts";

import { ensureSupabaseUser, getSupabaseServices } from "./config";

const SESSION_RECORDINGS_BUCKET = "session-recordings";

type SessionVideoAsset = {
  bucket: string;
  contentType: string;
  durationMs: number;
  hasAudio: boolean;
  height: number;
  path: string;
  width: number;
};

type SupabaseSessionRow = {
  completed_at: string;
  created_at: string;
  custom_practice_settings: SessionAnalysisPayload["customPracticeSettings"];
  display_transcript: string | null;
  duration_seconds: number;
  final_feedback: FeedbackSummary | null;
  generated_questions: SessionAnalysisPayload["generatedQuestions"];
  id: string;
  presence_summary: SessionAnalysisPayload["presence"];
  raw_transcript: string | null;
  scenario_description: string;
  scenario_focus: string;
  scenario_id: string;
  scenario_title: string;
  session_payload: SessionAnalysisPayload;
  session_type: "custom_practice" | "debate" | "scenario";
  transcript_turns: SessionAnalysisPayload["transcript"];
  updated_at: string;
  user_id: string;
  verbal_metrics: SessionAnalysisPayload["verbalMetrics"];
  video_assets: SessionVideoAsset[];
};

type SyncSessionOptions = {
  feedback: FeedbackSummary | null;
  recordingBlob?: Blob | null;
  snapshot: StoredSessionSnapshot;
};

function isSessionVideoAsset(value: unknown): value is SessionVideoAsset {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const asset = value as Partial<SessionVideoAsset>;

  return (
    typeof asset.bucket === "string" &&
    typeof asset.contentType === "string" &&
    typeof asset.durationMs === "number" &&
    typeof asset.hasAudio === "boolean" &&
    typeof asset.height === "number" &&
    typeof asset.path === "string" &&
    typeof asset.width === "number"
  );
}

function parseSessionVideoAssets(value: unknown) {
  if (!Array.isArray(value)) {
    return [] satisfies SessionVideoAsset[];
  }

  return value.filter(isSessionVideoAsset);
}

function getSessionType(payload: SessionAnalysisPayload) {
  if (payload.mode === "debate" || payload.debateSettings) {
    return "debate";
  }

  return payload.customPracticeSettings ? "custom_practice" : "scenario";
}

function buildSessionVideoPath(
  userId: string,
  sessionId: string,
  recording: SessionCameraRecording,
) {
  return `${userId}/${sessionId}/webcam.${recording.mimeType.includes("mp4") ? "mp4" : "webm"}`;
}

async function listStoragePathsRecursively(
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const services = getSupabaseServices();

  if (!services) {
    return [] satisfies string[];
  }

  const discoveredPaths = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await services.client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const entry of data) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.id === null) {
        const nestedPaths = await listStoragePathsRecursively(bucket, entryPath);

        nestedPaths.forEach((path) => {
          discoveredPaths.add(path);
        });
        continue;
      }

      discoveredPaths.add(entryPath);
    }

    if (data.length < 100) {
      break;
    }

    offset += data.length;
  }

  return Array.from(discoveredPaths);
}

async function uploadRecordingAsset(
  userId: string,
  sessionId: string,
  recording: SessionCameraRecording,
  blob: Blob,
) {
  const services = getSupabaseServices();

  if (!services) {
    return null;
  }

  const path = buildSessionVideoPath(userId, sessionId, recording);
  const { error } = await services.client.storage
    .from(SESSION_RECORDINGS_BUCKET)
    .upload(path, blob, {
      contentType: recording.mimeType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return {
    bucket: SESSION_RECORDINGS_BUCKET,
    contentType: recording.mimeType,
    durationMs: recording.durationMs,
    hasAudio: recording.hasAudio,
    height: recording.height,
    path,
    width: recording.width,
  } satisfies SessionVideoAsset;
}

async function loadStoredVideoAssets(userId: string, sessionId: string) {
  const services = getSupabaseServices();

  if (!services) {
    return [] satisfies SessionVideoAsset[];
  }

  const { data, error } = await services.client
    .from("sessions")
    .select("video_assets")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return [] satisfies SessionVideoAsset[];
  }

  return parseSessionVideoAssets((data as { video_assets?: unknown }).video_assets);
}

function buildPayloadWithDerivedText(payload: SessionAnalysisPayload): SessionAnalysisPayload {
  return {
    ...payload,
    displayTranscript:
      payload.displayTranscript ?? buildDisplayTranscript(payload.transcript),
    rawTranscript: payload.rawTranscript ?? buildRawTranscript(payload.transcript),
    verbalMetrics: payload.verbalMetrics ?? buildVerbalMetricsSummary(payload),
  };
}

function buildSessionRow(
  snapshot: StoredSessionSnapshot,
  userId: string,
  feedback: FeedbackSummary | null,
  videoAssets: SessionVideoAsset[],
): SupabaseSessionRow {
  const payload = buildPayloadWithDerivedText(snapshot.payload);

  return {
    completed_at: snapshot.completedAt,
    created_at: snapshot.completedAt,
    custom_practice_settings: payload.customPracticeSettings ?? null,
    display_transcript: payload.displayTranscript ?? null,
    duration_seconds: payload.durationSeconds,
    final_feedback: feedback,
    generated_questions: payload.generatedQuestions ?? null,
    id: snapshot.id,
    presence_summary: payload.presence ?? null,
    raw_transcript: payload.rawTranscript ?? null,
    scenario_description: payload.scenario.description,
    scenario_focus: payload.scenario.focus,
    scenario_id: payload.scenario.id,
    scenario_title: payload.scenario.title,
    session_payload: payload,
    session_type: getSessionType(payload),
    transcript_turns: payload.transcript,
    updated_at: new Date().toISOString(),
    user_id: userId,
    verbal_metrics: payload.verbalMetrics ?? null,
    video_assets: videoAssets,
  };
}

function toHistoryEntry(row: SupabaseSessionRow): StoredSessionHistoryEntry {
  const payload =
    row.session_payload ??
    ({
      cameraRecording: null,
      customPracticeSettings: row.custom_practice_settings ?? null,
      debateResult: null,
      debateSettings: null,
      displayTranscript: row.display_transcript,
      durationSeconds: row.duration_seconds,
      generatedQuestions: row.generated_questions ?? null,
      mode: row.session_type,
      presence: row.presence_summary ?? null,
      rawTranscript: row.raw_transcript,
      scenario: {
        description: row.scenario_description,
        focus: row.scenario_focus,
        id: row.scenario_id,
        title: row.scenario_title,
      },
      transcript: row.transcript_turns ?? [],
      verbalMetrics: row.verbal_metrics ?? null,
    } satisfies SessionAnalysisPayload);

  return {
    completedAt: row.completed_at,
    feedback: row.final_feedback ?? buildDeterministicFeedbackSummary(payload),
    id: row.id,
    payload,
  };
}

export async function syncSessionToSupabase({
  feedback,
  recordingBlob,
  snapshot,
}: SyncSessionOptions) {
  const services = getSupabaseServices();

  if (!services) {
    return false;
  }

  const user = await ensureSupabaseUser();

  if (!user) {
    return false;
  }

  const recording = snapshot.payload.cameraRecording;
  const finalFeedback =
    feedback ?? buildDeterministicFeedbackSummary(snapshot.payload);
  let videoAssets: SessionVideoAsset[] = [];

  if (recording && recordingBlob) {
    try {
      const uploadedAsset = await uploadRecordingAsset(
        user.id,
        snapshot.id,
        recording,
        recordingBlob,
      );

      if (uploadedAsset) {
        videoAssets = [uploadedAsset];
      }
    } catch (error) {
      console.warn("[voiceforge] Supabase recording upload skipped:", error);
    }
  }

  if (videoAssets.length === 0) {
    videoAssets = await loadStoredVideoAssets(user.id, snapshot.id);
  }

  const row = buildSessionRow(snapshot, user.id, finalFeedback, videoAssets);
  const { error } = await services.client.from("sessions").upsert(row);

  if (error) {
    throw error;
  }

  return true;
}

export async function loadSessionRecordingBlobFromSupabase(sessionId: string) {
  const services = getSupabaseServices();

  if (!services) {
    return null;
  }

  const user = await ensureSupabaseUser();

  if (!user) {
    return null;
  }

  const videoAssets = await loadStoredVideoAssets(user.id, sessionId);
  const primaryAsset = videoAssets[0];

  if (!primaryAsset) {
    return null;
  }

  const { data, error } = await services.client.storage
    .from(primaryAsset.bucket)
    .download(primaryAsset.path);

  if (error || !data) {
    return null;
  }

  return data;
}

export async function loadSessionSnapshotFromSupabase(sessionId: string) {
  const services = getSupabaseServices();

  if (!services) {
    return null;
  }

  const user = await ensureSupabaseUser();

  if (!user) {
    return null;
  }

  const { data, error } = await services.client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toHistoryEntry(data as SupabaseSessionRow);
}

export async function loadSessionHistoryFromSupabase() {
  const services = getSupabaseServices();

  if (!services) {
    return [] satisfies StoredSessionHistoryEntry[];
  }

  const user = await ensureSupabaseUser();

  if (!user) {
    return [] satisfies StoredSessionHistoryEntry[];
  }

  const { data, error } = await services.client
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false });

  if (error || !data) {
    return [] satisfies StoredSessionHistoryEntry[];
  }

  return data.map((row) => toHistoryEntry(row as SupabaseSessionRow));
}

export async function deleteSessionHistoryFromSupabase() {
  const services = getSupabaseServices();

  if (!services) {
    return 0;
  }

  const {
    data: { user },
  } = await services.client.auth.getUser();

  if (!user) {
    return 0;
  }

  const { data, error } = await services.client
    .from("sessions")
    .select("id, video_assets")
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  const assetsByBucket = new Map<string, Set<string>>();

  (data ?? []).forEach((row) => {
    const assets = parseSessionVideoAssets(
      (row as { video_assets?: unknown }).video_assets,
    );

    assets.forEach((asset) => {
      if (!assetsByBucket.has(asset.bucket)) {
        assetsByBucket.set(asset.bucket, new Set<string>());
      }

      assetsByBucket.get(asset.bucket)?.add(asset.path);
    });
  });

  const orphanedSessionRecordingPaths = await listStoragePathsRecursively(
    SESSION_RECORDINGS_BUCKET,
    user.id,
  );

  if (orphanedSessionRecordingPaths.length > 0) {
    if (!assetsByBucket.has(SESSION_RECORDINGS_BUCKET)) {
      assetsByBucket.set(SESSION_RECORDINGS_BUCKET, new Set<string>());
    }

    orphanedSessionRecordingPaths.forEach((path) => {
      assetsByBucket.get(SESSION_RECORDINGS_BUCKET)?.add(path);
    });
  }

  for (const [bucket, paths] of assetsByBucket.entries()) {
    const pathsToRemove = Array.from(paths);

    if (pathsToRemove.length === 0) {
      continue;
    }

    const { error: storageError } = await services.client.storage
      .from(bucket)
      .remove(pathsToRemove);

    if (storageError) {
      throw storageError;
    }
  }

  const { error: deleteError } = await services.client
    .from("sessions")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    throw deleteError;
  }

  return data?.length ?? 0;
}
