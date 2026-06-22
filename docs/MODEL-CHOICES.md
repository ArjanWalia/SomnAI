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

The face-analysis backbone is **Microsoft ResNet-50**
(https://huggingface.co/microsoft/resnet-50) — the exact ImageNet-1k ResNet-50
the MIST paper uses for its image modality. The official checkpoint is PyTorch,
which can't run on the web, so we load the **ONNX export of those same weights**
(`Xenova/resnet-50`) with **transformers.js** and run it fully on-device.

Each sample we crop the face and push it through ResNet-50; the Euclidean
distance between consecutive class-probability vectors is a continuous
**facial-activity / movement** signal — the paper's temporal/motion stream,
realized over real ResNet-50 features.

**MediaPipe Face Landmarker** plays a supporting role: it locates/crops the face
for ResNet and reads 52 ARKit blendshapes for expression cues (brow tension,
squint, frown, cringe — the FER paper's negative-affect signals). Pixel
heuristics add *sweat* (forehead specular highlights) and *eye-redness*
(R/(G+B)).

`tension = weighted sum (ResNet activity + expression + heuristics)`;
`calmness = 1 − tension`. ResNet inference is async + throttled so it never
blocks the per-second sampling loop; if a model fails to load the pipeline
degrades gracefully (MediaPipe-only, or audio-only).

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
