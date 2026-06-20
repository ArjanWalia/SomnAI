/**
 * Audio stress model — the "{best model} that analyses the audio of the user".
 *
 * Recommended model: **YAMNet** (an AudioSet MobileNet classifier) run in the
 * browser via TensorFlow.js, mapping classes like "Sigh", "Breathing", "Gasp"
 * and "Shout" to a stress signal. To keep the app working out-of-the-box with
 * no large model download, the shipped implementation is a transparent Web
 * Audio DSP classifier behind the same `AudioModel` interface: drop in a YAMNet
 * inference call inside `sample()` and the rest of the app is unchanged.
 *
 * It listens for the spec's cues — sighs, shallow breaths, and sounds of anger
 * — from short-term acoustic features (energy, spectral brightness, spectral
 * flux, zero-crossing rate, low-band breathing energy) and returns a calmness
 * score in [0,1].
 */

export interface AudioResult {
  /** 0 = extremely stressed, 1 = perfectly calm. */
  calmness: number;
  /** Detected cues this tick, e.g. ['sigh'] or ['anger']. */
  events: string[];
  /** Raw loudness 0–1, for the live meter. */
  level: number;
}

export interface AudioModel {
  sample(): AudioResult;
  close(): void;
}

const norm = (v: number, lo: number, hi: number) =>
  Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

export async function createAudioModel(stream: MediaStream): Promise<AudioModel> {
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const bins = analyser.frequencyBinCount;
  const freq = new Uint8Array(bins);
  const time = new Uint8Array(analyser.fftSize);
  let prevFreq = new Uint8Array(bins);

  const nyquist = ctx.sampleRate / 2;
  const hzPerBin = nyquist / bins;
  const lowBandBins = Math.max(1, Math.floor(400 / hzPerBin)); // ~breathing band

  return {
    sample(): AudioResult {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(time);

      // RMS + zero-crossing rate from the time domain.
      let sumSq = 0;
      let crossings = 0;
      for (let i = 0; i < time.length; i++) {
        const v = (time[i] - 128) / 128;
        sumSq += v * v;
        if (i > 0 && (time[i - 1] - 128) * (time[i] - 128) < 0) crossings++;
      }
      const rms = Math.sqrt(sumSq / time.length);
      const zcr = crossings / time.length;

      // Spectral features.
      let total = 0;
      let weighted = 0;
      let lowEnergy = 0;
      let flux = 0;
      for (let i = 0; i < bins; i++) {
        const m = freq[i];
        total += m;
        weighted += i * m;
        if (i < lowBandBins) lowEnergy += m;
        const d = m - prevFreq[i];
        if (d > 0) flux += d;
      }
      prevFreq = freq.slice();
      const centroidHz = total > 0 ? (weighted / total) * hzPerBin : 0;
      const lowBand = total > 0 ? lowEnergy / total : 0;

      const energy = norm(rms, 0.015, 0.15);
      const brightness = norm(centroidHz, 200, 3000);
      const fluxN = norm(flux / bins, 0.5, 8);
      const zcrN = norm(zcr, 0.05, 0.3);

      const agitation = Math.max(
        0,
        Math.min(1, 0.55 * energy + 0.25 * fluxN + 0.2 * zcrN),
      );
      const calmness = 1 - agitation;

      const events: string[] = [];
      if (energy > 0.6 && (brightness > 0.55 || fluxN > 0.6)) {
        events.push('anger');
      } else if (lowBand > 0.5 && brightness < 0.4 && energy > 0.25) {
        events.push('sigh');
      } else if (energy < 0.2 && lowBand > 0.35) {
        events.push('shallow_breath');
      }

      return { calmness, events, level: energy };
    },
    close() {
      source.disconnect();
      void ctx.close();
    },
  };
}
