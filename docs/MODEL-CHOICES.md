# Model choices — the two on-device stress models

The spec left the model as "{insert best model choice}". Two constraints decide
it: the models must run **on the user's computer in the browser**, in real time,
and they must estimate **calmness** from face/body and from sound. The two
research papers inform *what* to measure and *how* to fuse.

## What the papers say

- **MIST: Multimodal emotion recognition** (Boitel et al., 2025) — separate
  per-modality models fused by a **weighted average**: ResNet-50 (facial image),
  3D-CNN (facial-landmark *motion* over frames), and a **Semi-CNN over MFCC
  spectrograms** (speech). Modular: a weak modality doesn't cripple the result.
- **FER for Stress Detection using Deep CNN** (Kumar et al., 2025) — a CNN over
  FER-2013 classifies 7 emotions, then collapses them to a binary
  negative/positive → **stressed / not-stressed** signal.

Takeaways we apply: (1) split into a **video** model and an **audio** model and
**average** their scores (MIST fusion, simplified to equal weights per the spec);
(2) the **audio** model should be a **CNN over a (log-)mel spectrogram**;
(3) the **video** model should read **facial expression + landmark motion** and
map negative affect → stress.

## Video model — `web/src/lib/videoModel.ts`

Heavy nets (ResNet-50 / 3D-CNN) can't run live in a browser, so we realize the
*image + motion* modalities with **MediaPipe Face Landmarker** (468 landmarks +
52 ARKit blendshapes, WebGL):

- **Expression (image)** — blendshapes → brow tension, eye squint, frown, cringe
  (the negative-affect cues the FER paper ties to stress).
- **Pixel heuristics** — forehead specular highlights → *sweat*; R/(G+B) in the
  eye band → *eye-redness*.
- **Motion** — head-pose yaw oscillation (*head shake*) and face loss
  (*head-in-hands*) as frustration cues — the paper's temporal/motion stream.

`tension = weighted sum`; `calmness = 1 − tension`. If the model fails to load,
`analyze()` returns null and the pipeline runs on audio alone.

## Audio model — `web/src/lib/audioModel.ts`

**YAMNet** (MobileNet-style **CNN over a log-mel spectrogram**, 521 AudioSet
classes) via **TensorFlow.js** — the browser-feasible realization of the MIST
speech-CNN. We run it on rolling ~1s windows and map class probabilities:

- agitation ← shout / yell / scream / groan / crying / gasp / heavy breathing
- calm ← silence / neutral speech
- discrete events (sigh / shallow breath / anger) drive the detail view.

`calmness = 1 − agitation`. TF.js is **lazy-loaded** only when recording starts,
and if YAMNet can't load we fall back to a lightweight Web-Audio **DSP**
classifier (RMS energy, spectral centroid/flux, ZCR, breathing-band energy) so
recording always works offline.

## Fusion

Per second: `calmness = average(video, audio)` over whichever models produced a
value. Session `stress_score = round(mean(calmness) × 100, 1dp)`
(100 = perfectly calm), with stressed runs flagged per `DATA-CONTRACT.md`.

## Claude

Insights use **`claude-opus-4-8`** via `@anthropic-ai/sdk` with the user's own
key (browser-only), matching the iOS `ClaudeClient`.
