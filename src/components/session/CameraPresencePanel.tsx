import { CameraOff, LoaderCircle, Video } from "lucide-react";

import type { UseSessionCameraRecorderResult } from "@/hooks/useSessionCameraRecorder";
import { cn } from "@/shared/lib/cn";
import { Panel } from "@/shared/ui/panel";

type CameraPresencePanelProps = Pick<
  UseSessionCameraRecorderResult,
  "status" | "statusMessage" | "videoRef"
> & {
  cameraEnabled: boolean;
};

export function CameraPresencePanel({
  cameraEnabled,
  status,
  statusMessage,
  videoRef,
}: CameraPresencePanelProps) {
  return (
    <Panel className="overflow-hidden p-0" elevated>
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Camera capture
            </p>
            <h2 className="mt-2 text-lg font-semibold">Record for post-session review</h2>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              status === "recording" &&
                "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
              status === "requesting-permission" &&
                "border-primary/25 bg-primary/10 text-primary",
              status !== "recording" &&
                status !== "requesting-permission" &&
                "border-border bg-shell text-muted-foreground",
            )}
          >
            {status === "requesting-permission" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : cameraEnabled ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <CameraOff className="h-3.5 w-3.5" />
            )}
            {status === "recording"
              ? "Recording"
              : status === "requesting-permission"
                ? "Starting"
                : cameraEnabled
                  ? "Preview ready"
                  : "Camera off"}
          </div>
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden bg-shell">
        <video
          ref={videoRef}
          autoPlay
          className={cn(
            "absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]",
            !cameraEnabled && "opacity-0",
          )}
          muted
          playsInline
        />

        {!cameraEnabled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-3 text-center">
              <CameraOff className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Camera preview is turned off.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Capture timing",
              value: "Recorded during the live session, analyzed after it ends.",
            },
            {
              label: "Scoring flow",
              value: "MediaPipe runs on the saved session video instead of the live feed.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border bg-shell px-4 py-4"
            >
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm text-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-shell px-4 py-4">
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        </div>
      </div>
    </Panel>
  );
}
