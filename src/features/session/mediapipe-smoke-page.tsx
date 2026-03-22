import { LoaderCircle, ScanFace, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { loadFaceLandmarker } from "@/lib/mediapipe/faceLandmarker";
import { Panel } from "@/shared/ui/panel";

type SmokeState =
  | {
      stage?: string;
      status: "idle" | "loading";
    }
  | {
      faceCount: number;
      landmarkCount: number;
      stage: string;
      status: "passed";
    }
  | {
      message: string;
      stage: string;
      status: "failed";
    };

const SMOKE_IMAGE_PATH = "/images/test/mediapipe-face-smoke.png";

declare global {
  interface Window {
    __VOICEFORGE_MEDIAPIPE_SMOKE__?:
      | {
          faceCount?: number;
          landmarkCount?: number;
          message?: string;
          status: "failed" | "passed";
        }
      | undefined;
  }
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Smoke image failed to load."));
    image.src = src;
  });
}

export function MediaPipeSmokePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef("idle");
  const [state, setState] = useState<SmokeState>({
    status: "idle",
  });

  useEffect(() => {
    let cancelled = false;

    stageRef.current = "starting";
    setState({ stage: "starting", status: "loading" });
    window.__VOICEFORGE_MEDIAPIPE_SMOKE__ = undefined;

    void (async () => {
      try {
        const canvas = canvasRef.current;

        if (!canvas) {
          throw new Error("Smoke canvas is unavailable.");
        }

        stageRef.current = "loading-image";
        setState({ stage: "loading-image", status: "loading" });
        const image = await loadImage(SMOKE_IMAGE_PATH);
        const size = 512;
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Smoke canvas context is unavailable.");
        }

        context.drawImage(image, 0, 0, size, size);

        stageRef.current = "loading-face-landmarker";
        setState({ stage: "loading-face-landmarker", status: "loading" });
        const faceLandmarker = await Promise.race([
          loadFaceLandmarker(),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => {
              reject(new Error("Timed out while loading the MediaPipe Face Landmarker."));
            }, 20000);
          }),
        ]);
        let faceCount = 0;
        let landmarkCount = 0;

        stageRef.current = "running-detection";
        setState({ stage: "running-detection", status: "loading" });
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const result = faceLandmarker.detectForVideo(
            canvas,
            performance.now() + attempt * 16,
          );

          faceCount = result.faceLandmarks.length;
          landmarkCount = result.faceLandmarks[0]?.length ?? 0;

          if (faceCount > 0 && landmarkCount > 0) {
            break;
          }
        }

        if (cancelled) {
          return;
        }

        if (faceCount <= 0 || landmarkCount <= 0) {
          throw new Error("MediaPipe loaded, but no face was detected in the smoke frame.");
        }

        window.__VOICEFORGE_MEDIAPIPE_SMOKE__ = {
          faceCount,
          landmarkCount,
          status: "passed",
        };
        setState({
          faceCount,
          landmarkCount,
          stage: "completed",
          status: "passed",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown smoke test error.";

        if (cancelled) {
          return;
        }

        window.__VOICEFORGE_MEDIAPIPE_SMOKE__ = {
          message,
          status: "failed",
        };
        setState({
          message,
          stage: stageRef.current,
          status: "failed",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-app-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-app-radial" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
        <Panel className="w-full p-8" elevated>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            MediaPipe Smoke Test
          </p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl font-semibold">
                Browser-side Face Landmarker check
              </h1>
              <p className="text-sm leading-7 text-muted-foreground">
                This route loads the production MediaPipe Face Landmarker, draws a
                local face image into a canvas, and runs the same video-mode API
                used by the live session.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-shell px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 text-lg font-semibold">
                {state.status === "passed"
                  ? "MEDIAPIPE_SMOKE_PASS"
                  : state.status === "failed"
                    ? "MEDIAPIPE_SMOKE_FAIL"
                    : "MEDIAPIPE_SMOKE_RUNNING"}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-shell p-4">
                <canvas
                  ref={canvasRef}
                  className="aspect-square w-full rounded-2xl bg-panel"
                />
              </div>
            </div>

            <div className="space-y-4">
              {state.status === "loading" || state.status === "idle" ? (
                <div className="rounded-3xl border border-primary/25 bg-primary/10 p-5">
                  <div className="flex items-start gap-3">
                    <LoaderCircle className="mt-0.5 h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="font-medium">Loading model and test frame</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Waiting for the browser to initialize MediaPipe.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {state.status === "passed" ? (
                <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-5">
                  <div className="flex items-start gap-3">
                    <ScanFace className="mt-0.5 h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="font-medium">MediaPipe smoke passed</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Detected {state.faceCount} face with {state.landmarkCount} landmarks.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {state.status === "failed" ? (
                <div className="rounded-3xl border border-danger/30 bg-danger/10 p-5">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 text-danger" />
                    <div>
                      <p className="font-medium">MediaPipe smoke failed</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {state.message}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <pre className="overflow-x-auto rounded-3xl border border-border bg-shell p-5 text-xs leading-6 text-muted-foreground">
{JSON.stringify(state, null, 2)}
              </pre>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
