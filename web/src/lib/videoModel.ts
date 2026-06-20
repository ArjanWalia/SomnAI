/**
 * Video stress model — the "{best model} that analyses the video of the user".
 *
 * Chosen model: Google MediaPipe **Face Landmarker** (Tasks Vision), which runs
 * fully on the user's computer (WASM + WebGL) and emits 52 facial *blendshape*
 * coefficients. We read the tension-related blendshapes (brow lowering, eye
 * squint, mouth frown, nose sneer/cringe) and combine them with two cheap CV
 * heuristics on the frame — forehead specular highlights (sweat) and eye-region
 * redness — into a calmness score in [0,1].
 *
 * Everything degrades gracefully: if the model can't be fetched, `analyze`
 * returns null and the pipeline simply relies on the audio model.
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface VideoFeatures {
  /** 0–1 brow furrow / lowering (frustration). */
  browTension: number;
  /** 0–1 eye squint. */
  eyeSquint: number;
  /** 0–1 mouth frown / press. */
  frown: number;
  /** 0–1 nose sneer / cringe. */
  cringe: number;
  /** 0–1 estimated sweat (forehead specular highlights). */
  sweat: number;
  /** 0–1 estimated eye redness. */
  eyeRedness: number;
  /** Whether a face was detected this frame. */
  faceVisible: boolean;
}

export interface VideoResult {
  /** 0 = extremely stressed, 1 = perfectly calm. */
  calmness: number;
  features: VideoFeatures;
}

export interface VideoModel {
  analyze(video: HTMLVideoElement, timestampMs: number): VideoResult | null;
  close(): void;
}

function blend(result: FaceLandmarkerResult, name: string): number {
  const cats = result.faceBlendshapes?.[0]?.categories;
  if (!cats) return 0;
  return cats.find((c) => c.categoryName === name)?.score ?? 0;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Reused offscreen canvas for the lightweight CV heuristics.
const work = (() => {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 120;
  return { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) };
})();

/** Specular-highlight ratio in a forehead strip → a sweat proxy. */
function estimateSweat(video: HTMLVideoElement): number {
  const { canvas, ctx } = work;
  if (!ctx || !video.videoWidth) return 0;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  // Forehead ≈ upper-middle of the frame.
  const x = canvas.width * 0.3;
  const w = canvas.width * 0.4;
  const y = canvas.height * 0.12;
  const h = canvas.height * 0.18;
  const { data } = ctx.getImageData(x, y, w, h);
  let bright = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum > 210) bright++;
  }
  return clamp01((bright / px) * 3); // small fractions still register
}

/** Redness ratio in the eye band → an eye-redness proxy. */
function estimateRedness(video: HTMLVideoElement): number {
  const { canvas, ctx } = work;
  if (!ctx || !video.videoWidth) return 0;
  const x = canvas.width * 0.25;
  const w = canvas.width * 0.5;
  const y = canvas.height * 0.36;
  const h = canvas.height * 0.12;
  const { data } = ctx.getImageData(x, y, w, h);
  let ratioSum = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    ratioSum += r / (g + b + 1);
  }
  const avg = ratioSum / px; // ~0.5 neutral skin, higher = redder
  return clamp01((avg - 0.55) * 2.5);
}

export async function createVideoModel(): Promise<VideoModel> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    outputFaceBlendshapes: true,
    numFaces: 1,
  });

  return {
    analyze(video, timestampMs) {
      if (!video.videoWidth) return null;
      const result = landmarker.detectForVideo(video, timestampMs);
      const faceVisible = (result.faceBlendshapes?.length ?? 0) > 0;

      // Tension blendshapes (averaged L/R where applicable).
      const browTension = clamp01(
        (blend(result, 'browDownLeft') + blend(result, 'browDownRight')) / 2 +
          blend(result, 'browInnerUp') * 0.3,
      );
      const eyeSquint = clamp01(
        (blend(result, 'eyeSquintLeft') + blend(result, 'eyeSquintRight')) / 2,
      );
      const frown = clamp01(
        (blend(result, 'mouthFrownLeft') + blend(result, 'mouthFrownRight')) / 2 +
          (blend(result, 'mouthPressLeft') + blend(result, 'mouthPressRight')) / 2,
      );
      const cringe = clamp01(
        (blend(result, 'noseSneerLeft') + blend(result, 'noseSneerRight')) / 2 +
          blend(result, 'mouthStretchLeft') * 0.5,
      );

      const sweat = estimateSweat(video);
      const eyeRedness = estimateRedness(video);

      // Weighted tension → calmness. Facial expression dominates; sweat/redness
      // are softer modifiers. Calmness defaults high when no face is present.
      const tension = faceVisible
        ? clamp01(
            0.32 * browTension +
              0.22 * eyeSquint +
              0.24 * frown +
              0.12 * cringe +
              0.06 * sweat +
              0.04 * eyeRedness,
          )
        : 0.15;

      return {
        calmness: clamp01(1 - tension),
        features: { browTension, eyeSquint, frown, cringe, sweat, eyeRedness, faceVisible },
      };
    },
    close() {
      landmarker.close();
    },
  };
}
