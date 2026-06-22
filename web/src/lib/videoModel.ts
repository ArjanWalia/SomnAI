/**
 * Video stress model — facial expression + body movement → calmness [0,1].
 *
 * Realizes the MIST paper's image (facial) + motion modalities and the
 * FER-stress paper's "negative expression → stress" mapping in the browser
 * using MediaPipe's Face Landmarker (52 ARKit-style blendshapes + landmarks):
 *
 *   - brow tension, eye squint, frown, cringe  (negative-affect blendshapes)
 *   - sweat (forehead specular highlights) and eye-redness (pixel heuristics)
 *   - body movement: head-shake (yaw oscillation) and head-in-hands
 *     (face lost) as frustration cues — the paper's temporal/motion stream
 *
 * tension = weighted sum of the above; calmness = 1 − tension.
 * If the model can't load, analyze() returns null and the pipeline falls back
 * to audio only.
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

export interface VideoSignals {
  browTension: number;
  eyeSquint: number;
  frown: number;
  cringe: number;
  sweat: number;
  eyeRedness: number;
  headMotion: number;
  tension: number;
  calmness: number;
  faceVisible: boolean;
}

export class VideoStressModel {
  private landmarker: FaceLandmarker | null = null;
  private loadError: string | null = null;
  private lastYaw: number | null = null;
  private yawHistory: number[] = [];

  get error(): string | null {
    return this.loadError;
  }

  async load(): Promise<boolean> {
    if (this.landmarker) return true;
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      return true;
    } catch (e) {
      this.loadError = `Face model unavailable: ${String(e)}`;
      return false;
    }
  }

  /** Analyze one frame. Returns null if the model isn't loaded. */
  analyze(video: HTMLVideoElement, tMillis: number): VideoSignals | null {
    if (!this.landmarker) return null;
    let result: FaceLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, tMillis);
    } catch {
      return null;
    }

    const blend = result.faceBlendshapes?.[0]?.categories ?? [];
    const faceVisible = blend.length > 0;
    const get = (name: string) =>
      blend.find((c) => c.categoryName === name)?.score ?? 0;

    if (!faceVisible) {
      // Face lost — often "head in hands". Treat as mild stress, not neutral.
      this.lastYaw = null;
      return {
        browTension: 0,
        eyeSquint: 0,
        frown: 0,
        cringe: 0,
        sweat: 0,
        eyeRedness: 0,
        headMotion: 0.4,
        tension: 0.35,
        calmness: 0.65,
        faceVisible: false,
      };
    }

    const browTension = clamp01(
      (get('browDownLeft') + get('browDownRight')) / 2 + get('browInnerUp') * 0.3,
    );
    const eyeSquint = clamp01((get('eyeSquintLeft') + get('eyeSquintRight')) / 2);
    const frown = clamp01(
      (get('mouthFrownLeft') + get('mouthFrownRight')) / 2 +
        (get('mouthPressLeft') + get('mouthPressRight')) / 2,
    );
    const cringe = clamp01(
      (get('noseSneerLeft') + get('noseSneerRight')) / 2 +
        get('mouthStretchLeft') * 0.5,
    );

    const sweat = this.estimateSweat(video);
    const eyeRedness = this.estimateRedness(video);
    const headMotion = this.estimateHeadMotion(result);

    const tension = clamp01(
      0.3 * browTension +
        0.2 * eyeSquint +
        0.22 * frown +
        0.12 * cringe +
        0.05 * sweat +
        0.04 * eyeRedness +
        0.07 * headMotion,
    );

    return {
      browTension,
      eyeSquint,
      frown,
      cringe,
      sweat,
      eyeRedness,
      headMotion,
      tension,
      calmness: clamp01(1 - tension),
      faceVisible: true,
    };
  }

  /** Head-shake (rapid yaw oscillation) → frustration signal. */
  private estimateHeadMotion(result: FaceLandmarkerResult): number {
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    if (!matrix) return 0;
    // Yaw from the rotation matrix (column-major 4x4).
    const yaw = Math.atan2(matrix[8], matrix[10]);
    if (this.lastYaw != null) {
      const delta = Math.abs(yaw - this.lastYaw);
      this.yawHistory.push(delta);
      if (this.yawHistory.length > 8) this.yawHistory.shift();
    }
    this.lastYaw = yaw;
    const avg =
      this.yawHistory.reduce((a, b) => a + b, 0) /
      Math.max(1, this.yawHistory.length);
    return clamp01(avg * 4); // small radians/frame → noticeable motion
  }

  private sampleCanvas = document.createElement('canvas');

  private regionStats(
    video: HTMLVideoElement,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { r: number; g: number; b: number; lum: number; bright: number } | null {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const c = this.sampleCanvas;
    const sw = Math.max(1, Math.floor((x1 - x0) * w));
    const sh = Math.max(1, Math.floor((y1 - y0) * h));
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, x0 * w, y0 * h, sw, sh, 0, 0, sw, sh);
    let r = 0,
      g = 0,
      b = 0,
      bright = 0;
    const data = ctx.getImageData(0, 0, sw, sh).data;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum > 210) bright += 1;
    }
    return { r: r / n, g: g / n, b: b / n, lum: 0, bright: bright / n };
  }

  /** Forehead specular highlights → sweat proxy. */
  private estimateSweat(video: HTMLVideoElement): number {
    const s = this.regionStats(video, 0.35, 0.08, 0.65, 0.22);
    if (!s) return 0;
    return clamp01(s.bright * 3);
  }

  /** Redness (R / (G+B)) in the eye band. */
  private estimateRedness(video: HTMLVideoElement): number {
    const s = this.regionStats(video, 0.3, 0.32, 0.7, 0.45);
    if (!s) return 0;
    const ratio = s.r / (s.g + s.b + 1);
    return clamp01((ratio - 0.55) * 2.5);
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
