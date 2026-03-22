declare module "@mediapipe/tasks-vision" {
  export interface Category {
    categoryName: string;
    displayName: string;
    index: number;
    score: number;
  }

  export interface Classifications {
    categories: Category[];
    headIndex: number;
    headName: string;
  }

  export interface Matrix {
    columns: number;
    data: number[];
    rows: number;
  }

  export interface NormalizedLandmark {
    visibility: number;
    x: number;
    y: number;
    z: number;
  }

  export interface FaceLandmarkerResult {
    faceBlendshapes: Classifications[];
    faceLandmarks: NormalizedLandmark[][];
    facialTransformationMatrixes: Matrix[];
  }

  export interface WasmFileset {}

  type ImageSource =
    | HTMLCanvasElement
    | HTMLImageElement
    | HTMLVideoElement
    | ImageBitmap
    | OffscreenCanvas;

  export class FilesetResolver {
    static forVisionTasks(
      basePath?: string,
      useModule?: boolean,
    ): Promise<WasmFileset>;
  }

  export class FaceLandmarker {
    static createFromOptions(
      wasmFileset: WasmFileset,
      options: {
        baseOptions?: {
          delegate?: "CPU" | "GPU";
          modelAssetPath?: string;
        };
        minFaceDetectionConfidence?: number;
        minFacePresenceConfidence?: number;
        minTrackingConfidence?: number;
        numFaces?: number;
        outputFaceBlendshapes?: boolean;
        outputFacialTransformationMatrixes?: boolean;
        runningMode?: "image" | "video";
      },
    ): Promise<FaceLandmarker>;

    close(): void;
    detectForVideo(videoFrame: ImageSource, timestamp: number): FaceLandmarkerResult;
  }
}
