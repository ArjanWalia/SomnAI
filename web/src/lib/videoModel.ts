/**
 * Video stress model — facial expression + body movement → calmness [0,1].
 *
 * Face analysis backbone: **Microsoft ResNet-50**
 * (https://huggingface.co/microsoft/resnet-50) — the ImageNet-1k ResNet-50 the
 * MIST paper uses for its image/facial modality. We run it in the browser with
 * transformers.js using the ONNX export of those exact weights
 * (`Xenova/resnet-50`), since the official PyTorch checkpoint can't run on the
 * web directly.
 *
 * Each sample we crop the face and push it through ResNet-50; the frame-to-frame
 * movement of its class-probability vector is a continuous "facial activity"
 * signal (the paper's temporal/motion stream). MediaPipe Face Landmarker is used
 * only to (a) locate/crop the face for ResNet and (b) read ARKit-style
 * expression blendshapes (brow tension, squint, frown, cringe) — the FER-stress
 * paper's "negative expression → stress" cues. Pixel heuristics add sweat
 * (forehead specular highlights) and eye-redness.
 *
 * tension = weighted sum of the above; calmness = 1 − tension.
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { pipeline, env } from '@huggingface/transformers';

/** Minimal callable shape for the image-classification pipeline (avoids the
 *  library's overly-complex overload union in TS). */
type Classifier = (
  input: string,
  options?: Record<string, unknown>,
) => Promise<Array<{ label: string; score: number }>>;

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Microsoft ResNet-50 ImageNet-1k weights, ONNX export for in-browser use. */
export const RESNET_MODEL_ID = 'Xenova/resnet-50';

// Load models from the HF hub (not bundled locally).
env.allowLocalModels = false;

export interface VideoSignals {
  browTension: number;
  eyeSquint: number;
  frown: number;
  cringe: number;
  sweat: number;
  eyeRedness: number;
  resnetActivity: number;
  tension: number;
  calmness: number;
  faceVisible: boolean;
}

export class VideoStressModel {
  private landmarker: FaceLandmarker | null = null;
  private resnet: Classifier | null = null;
  private loadError: string | null = null;

  private resnetActivity = 0;
  private resnetBusy = false;
  private lastProbs: number[] | null = null;
  private cropCanvas = document.createElement('canvas');

  get error(): string | null {
    return this.loadError;
  }

  /** Loads ResNet-50 (required) and MediaPipe (best-effort for cropping/cues). */
  async load(): Promise<boolean> {
    try {
      if (!this.resnet) {
        const makePipeline = pipeline as unknown as (
          task: string,
          model: string,
        ) => Promise<Classifier>;
        this.resnet = await makePipeline('image-classification', RESNET_MODEL_ID);
      }
    } catch (e) {
      this.loadError = `ResNet-50 unavailable: ${String(e)}`;
      return false;
    }
    // MediaPipe is optional — if it fails we crop the center and skip blendshapes.
    if (!this.landmarker) {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      } catch {
        this.landmarker = null;
      }
    }
    return true;
  }

  /** Analyze one frame. Returns null if no model is loaded. */
  analyze(video: HTMLVideoElement, tMillis: number): VideoSignals | null {
    if (!this.resnet && !this.landmarker) return null;

    let blend: { categoryName: string; score: number }[] = [];
    let bbox: [number, number, number, number] | null = null;
    if (this.landmarker) {
      try {
        const result = this.landmarker.detectForVideo(video, tMillis);
        blend = result.faceBlendshapes?.[0]?.categories ?? [];
        bbox = faceBbox(result);
      } catch {
        /* ignore a dropped frame */
      }
    }
    const faceVisible = blend.length > 0 || bbox != null;

    // Kick off (throttled) ResNet-50 inference on the face crop.
    void this.runResnet(video, bbox);

    const get = (name: string) =>
      blend.find((c) => c.categoryName === name)?.score ?? 0;
    const browTension = clamp01(
      (get('browDownLeft') + get('browDownRight')) / 2 + get('browInnerUp') * 0.3,
    );
    const eyeSquint = clamp01((get('eyeSquintLeft') + get('eyeSquintRight')) / 2);
    const frown = clamp01(
      (get('mouthFrownLeft') + get('mouthFrownRight')) / 2 +
        (get('mouthPressLeft') + get('mouthPressRight')) / 2,
    );
    const cringe = clamp01(
      (get('noseSneerLeft') + get('noseSneerRight')) / 2 + get('mouthStretchLeft') * 0.5,
    );
    const sweat = this.estimateSweat(video);
    const eyeRedness = this.estimateRedness(video);
    const resnetActivity = this.resnetActivity;

    if (!faceVisible) {
      // Face lost — often "head in hands". Mild stress, not neutral.
      return blank(0.35, resnetActivity);
    }

    const tension = clamp01(
      0.26 * browTension +
        0.18 * eyeSquint +
        0.2 * frown +
        0.1 * cringe +
        0.05 * sweat +
        0.04 * eyeRedness +
        0.17 * resnetActivity,
    );

    return {
      browTension,
      eyeSquint,
      frown,
      cringe,
      sweat,
      eyeRedness,
      resnetActivity,
      tension,
      calmness: clamp01(1 - tension),
      faceVisible: true,
    };
  }

  /**
   * Run ResNet-50 on the face crop; the distance between consecutive
   * class-probability vectors is a facial-activity / movement proxy.
   * Async + throttled so the synchronous analyze() never blocks.
   */
  private async runResnet(
    video: HTMLVideoElement,
    bbox: [number, number, number, number] | null,
  ): Promise<void> {
    if (!this.resnet || this.resnetBusy) return;
    const dataUrl = this.cropToDataUrl(video, bbox);
    if (!dataUrl) return;
    this.resnetBusy = true;
    try {
      const out = await this.resnet(dataUrl, { top_k: 0 });
      const probs = out.map((o) => o.score);
      if (this.lastProbs && probs.length === this.lastProbs.length) {
        let sum = 0;
        for (let i = 0; i < probs.length; i++) {
          const d = probs[i] - this.lastProbs[i];
          sum += d * d;
        }
        // Euclidean distance between distributions → [0,1] activity.
        this.resnetActivity = clamp01(Math.sqrt(sum) * 6);
      }
      this.lastProbs = probs;
    } catch {
      /* transient inference failure — keep last activity */
    } finally {
      this.resnetBusy = false;
    }
  }

  /** Crop the face (or center square) to a 224×224 data URL for ResNet. */
  private cropToDataUrl(
    video: HTMLVideoElement,
    bbox: [number, number, number, number] | null,
  ): string | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    let sx: number, sy: number, sw: number, sh: number;
    if (bbox) {
      [sx, sy, sw, sh] = [bbox[0] * vw, bbox[1] * vh, bbox[2] * vw, bbox[3] * vh];
    } else {
      const side = Math.min(vw, vh);
      sx = (vw - side) / 2;
      sy = (vh - side) / 2;
      sw = side;
      sh = side;
    }
    const c = this.cropCanvas;
    c.width = 224;
    c.height = 224;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 224, 224);
    return c.toDataURL('image/jpeg', 0.8);
  }

  private sampleCanvas = document.createElement('canvas');

  private regionStats(
    video: HTMLVideoElement,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { r: number; g: number; b: number; bright: number } | null {
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
    return { r: r / n, g: g / n, b: b / n, bright: bright / n };
  }

  /** Forehead specular highlights → sweat proxy. */
  private estimateSweat(video: HTMLVideoElement): number {
    const s = this.regionStats(video, 0.35, 0.08, 0.65, 0.22);
    return s ? clamp01(s.bright * 3) : 0;
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
    this.resnet = null;
    this.lastProbs = null;
  }
}

/** Bounding box [x, y, w, h] in normalized coords from the face landmarks. */
function faceBbox(result: FaceLandmarkerResult): [number, number, number, number] | null {
  const pts = result.faceLandmarks?.[0];
  if (!pts || pts.length === 0) return null;
  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  // Pad ~12% around the face.
  const padX = (maxX - minX) * 0.12;
  const padY = (maxY - minY) * 0.12;
  minX = clamp01(minX - padX);
  minY = clamp01(minY - padY);
  maxX = clamp01(maxX + padX);
  maxY = clamp01(maxY + padY);
  return [minX, minY, maxX - minX, maxY - minY];
}

function blank(tension: number, resnetActivity: number): VideoSignals {
  return {
    browTension: 0,
    eyeSquint: 0,
    frown: 0,
    cringe: 0,
    sweat: 0,
    eyeRedness: 0,
    resnetActivity,
    tension,
    calmness: clamp01(1 - tension),
    faceVisible: false,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
