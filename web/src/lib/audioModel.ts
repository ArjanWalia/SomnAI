/**
 * Audio stress model — sounds the user makes → calmness [0,1].
 *
 * Primary: YAMNet (a CNN over a log-mel spectrogram) loaded with TensorFlow.js
 * — the browser-feasible realization of the speech-CNN in the MIST paper. It
 * classifies ~1s windows into AudioSet classes; we map agitation classes
 * (shout/yell/scream/anger, groan, crying, gasp, heavy breathing) → stressed,
 * and quiet/neutral speech/breathing → calm.
 *
 * Fallback: if YAMNet can't load, a lightweight Web-Audio DSP classifier (RMS
 * energy, spectral centroid, flux, zero-crossing rate, breathing-band energy)
 * keeps recording fully functional offline.
 *
 * Both expose the same sample() → { calmness, event } interface.
 */

import type * as TF from '@tensorflow/tfjs';

export type AudioEvent = 'sigh' | 'shallow_breath' | 'anger' | null;

export interface AudioSample {
  calmness: number; // [0,1]
  agitation: number; // [0,1]
  event: AudioEvent;
  energy: number;
}

const YAMNET_MODEL_URL =
  'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1/model.json';
const YAMNET_CLASS_MAP_URL =
  'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv';
const YAMNET_SR = 16000;
const YAMNET_WIN = 15600; // ~0.975s at 16kHz

/** Names → role used to build an agitation score from class probabilities. */
const ANGER_CLASSES = [
  'Shout',
  'Bellow',
  'Yell',
  'Screaming',
  'Children shouting',
  'Whoop',
  'Roar',
  'Groan',
  'Grunt',
  'Crying, sobbing',
];
const SIGH_CLASSES = ['Sigh'];
const SHALLOW_CLASSES = ['Breathing', 'Gasp', 'Pant', 'Wheeze', 'Snort'];
const CALM_CLASSES = ['Silence', 'Speech', 'Conversation', 'Narration, monologue'];

export class AudioStressModel {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode;
  private freq: Uint8Array<ArrayBuffer>;
  private time: Float32Array<ArrayBuffer>;
  private prevSpectrum: Float32Array | null = null;

  private tf: typeof TF | null = null;
  private yamnet: TF.GraphModel | null = null;
  private classNames: string[] = [];
  private ring: Float32Array = new Float32Array(YAMNET_WIN);
  private ringFill = 0;
  private resampleRatio: number;
  private loadError: string | null = null;

  constructor(stream: MediaStream) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    this.source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;
    this.source.connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.time = new Float32Array(this.analyser.fftSize);
    this.resampleRatio = this.ctx.sampleRate / YAMNET_SR;
  }

  get usingMl(): boolean {
    return this.yamnet != null;
  }
  get error(): string | null {
    return this.loadError;
  }

  /** Best-effort YAMNet load. Safe to call once; failure → DSP fallback. */
  async load(): Promise<boolean> {
    if (this.yamnet) return true;
    try {
      this.tf = await import('@tensorflow/tfjs');
      const [model, csv] = await Promise.all([
        this.tf.loadGraphModel(YAMNET_MODEL_URL),
        fetch(YAMNET_CLASS_MAP_URL).then((r) => r.text()),
      ]);
      this.yamnet = model;
      this.classNames = csv
        .trim()
        .split('\n')
        .slice(1)
        .map((line) => line.split(',').slice(2).join(',').replace(/^"|"$/g, ''));
      return true;
    } catch (e) {
      this.loadError = `YAMNet unavailable, using DSP fallback: ${String(e)}`;
      return false;
    }
  }

  /** Pull a fresh ~1s analysis. Call about once per second. */
  async sample(): Promise<AudioSample> {
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getFloatTimeDomainData(this.time);
    this.accumulate(this.time);

    if (this.yamnet) {
      const ml = await this.sampleYamnet();
      if (ml) return ml;
    }
    return this.sampleDsp();
  }

  // --- YAMNet path ---

  private accumulate(frame: Float32Array): void {
    // Cheap nearest-neighbour downsample from device SR to 16kHz into a ring.
    for (let i = 0; i < frame.length; i += this.resampleRatio) {
      this.ring[this.ringFill] = frame[Math.floor(i)] ?? 0;
      this.ringFill = (this.ringFill + 1) % YAMNET_WIN;
    }
  }

  private async sampleYamnet(): Promise<AudioSample | null> {
    if (!this.yamnet || !this.tf) return null;
    const tf = this.tf;
    try {
      const scores = tf.tidy(() => {
        const wave = tf.tensor1d(Array.from(this.ring));
        const out = this.yamnet!.execute(wave) as TF.Tensor | TF.Tensor[];
        const scoreTensor = Array.isArray(out) ? out[0] : out;
        // [frames, 521] → mean over frames.
        return scoreTensor.mean(0);
      });
      const probs = (await scores.data()) as Float32Array;
      scores.dispose();

      const sum = (names: string[]) =>
        names.reduce((acc, n) => acc + (probs[this.classNames.indexOf(n)] ?? 0), 0);

      const anger = sum(ANGER_CLASSES);
      const sigh = sum(SIGH_CLASSES);
      const shallow = sum(SHALLOW_CLASSES);
      const calm = sum(CALM_CLASSES);

      const agitation = clamp01(anger * 1.4 + sigh * 0.8 + shallow * 0.5 - calm * 0.2);
      let event: AudioEvent = null;
      if (anger > 0.15 && anger >= sigh && anger >= shallow) event = 'anger';
      else if (sigh > 0.1) event = 'sigh';
      else if (shallow > 0.15) event = 'shallow_breath';

      return {
        calmness: clamp01(1 - agitation),
        agitation,
        event,
        energy: rms(this.time),
      };
    } catch {
      return null;
    }
  }

  // --- DSP fallback path ---

  private sampleDsp(): AudioSample {
    const energy = norm(rms(this.time), 0.015, 0.15);
    const centroid = this.spectralCentroid();
    const brightness = norm(centroid, 200, 3000);
    const flux = this.spectralFlux();
    const zcr = norm(zeroCrossingRate(this.time), 0.05, 0.3);
    const lowBand = this.lowBandEnergy();

    const agitation = clamp01(0.55 * energy + 0.25 * flux + 0.2 * zcr);

    let event: AudioEvent = null;
    if (energy > 0.6 && (brightness > 0.55 || flux > 0.6)) event = 'anger';
    else if (lowBand > 0.5 && brightness < 0.4 && energy > 0.25) event = 'sigh';
    else if (energy < 0.2 && lowBand > 0.35) event = 'shallow_breath';

    return { calmness: clamp01(1 - agitation), agitation, event, energy };
  }

  private spectralCentroid(): number {
    let num = 0,
      den = 0;
    const nyquist = this.ctx.sampleRate / 2;
    for (let i = 0; i < this.freq.length; i++) {
      const mag = this.freq[i] / 255;
      const hz = (i / this.freq.length) * nyquist;
      num += hz * mag;
      den += mag;
    }
    return den > 0 ? num / den : 0;
  }

  private spectralFlux(): number {
    const cur = Float32Array.from(this.freq, (v) => v / 255);
    let flux = 0;
    if (this.prevSpectrum) {
      for (let i = 0; i < cur.length; i++) {
        const d = cur[i] - this.prevSpectrum[i];
        if (d > 0) flux += d;
      }
    }
    this.prevSpectrum = cur;
    return norm(flux / cur.length, 0.005, 0.08);
  }

  private lowBandEnergy(): number {
    const nyquist = this.ctx.sampleRate / 2;
    const cutoffBin = Math.floor((400 / nyquist) * this.freq.length);
    let sum = 0;
    for (let i = 0; i < cutoffBin; i++) sum += this.freq[i] / 255;
    return clamp01(sum / Math.max(1, cutoffBin));
  }

  async close(): Promise<void> {
    try {
      this.source.disconnect();
      await this.ctx.close();
    } catch {
      /* ignore */
    }
    this.yamnet?.dispose();
    this.yamnet = null;
  }
}

function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

function zeroCrossingRate(buf: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < buf.length; i++) {
    if ((buf[i] >= 0 && buf[i - 1] < 0) || (buf[i] < 0 && buf[i - 1] >= 0)) crossings += 1;
  }
  return crossings / buf.length;
}

function norm(v: number, lo: number, hi: number): number {
  return clamp01((v - lo) / (hi - lo));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
