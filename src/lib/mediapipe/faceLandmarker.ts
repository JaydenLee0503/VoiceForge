import type {
  FaceLandmarkerResult,
  FaceLandmarker as MediaPipeFaceLandmarker,
} from "@mediapipe/tasks-vision";

const MEDIAPIPE_VERSION = "0.10.33";
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type MediaPipeModule = typeof import("@mediapipe/tasks-vision");
type FaceLandmarkerDelegate = "CPU" | "GPU";

let mediapipeModulePromise: Promise<MediaPipeModule> | null = null;
const faceLandmarkerPromises: Partial<
  Record<FaceLandmarkerDelegate, Promise<MediaPipeFaceLandmarker>>
> = {};

async function loadMediaPipeModule() {
  if (!mediapipeModulePromise) {
    mediapipeModulePromise = import("@mediapipe/tasks-vision");
  }

  return mediapipeModulePromise;
}

async function createFaceLandmarker(delegate: FaceLandmarkerDelegate) {
  const { FaceLandmarker, FilesetResolver } = await loadMediaPipeModule();
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      delegate,
      modelAssetPath: FACE_LANDMARKER_MODEL_URL,
    },
    minFaceDetectionConfidence: 0.45,
    minFacePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    runningMode: "video",
  });
}

function loadFaceLandmarkerForDelegate(delegate: FaceLandmarkerDelegate) {
  const existingPromise = faceLandmarkerPromises[delegate];

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = createFaceLandmarker(delegate).catch((error) => {
    delete faceLandmarkerPromises[delegate];
    throw error;
  });
  faceLandmarkerPromises[delegate] = nextPromise;
  return nextPromise;
}

export async function loadFaceLandmarker(preferredDelegate: FaceLandmarkerDelegate = "GPU") {
  if (preferredDelegate === "CPU") {
    return loadFaceLandmarkerForDelegate("CPU");
  }

  try {
    return await loadFaceLandmarkerForDelegate("GPU");
  } catch (gpuError) {
    console.warn(
      "[voiceforge] Falling back to CPU Face Landmarker:",
      gpuError,
    );
    return loadFaceLandmarkerForDelegate("CPU");
  }
}

export function resetFaceLandmarker(delegate?: FaceLandmarkerDelegate) {
  const delegates = delegate ? [delegate] : (["GPU", "CPU"] as const);

  delegates.forEach((nextDelegate) => {
    const instancePromise = faceLandmarkerPromises[nextDelegate];

    void instancePromise?.then((instance) => {
      instance.close();
    });

    delete faceLandmarkerPromises[nextDelegate];
  });
}

export type { FaceLandmarkerResult };
