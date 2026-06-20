/**
 * Records a work session from the computer's camera + mic.
 *
 * We capture two artefacts so they can be stored where they belong (spec):
 *   - a video+audio WebM for the video bucket, and
 *   - an audio-only WebM for the more space-efficient audio store.
 *
 * The actual ML analysis runs live off the same MediaStream (see videoModel /
 * audioModel); this class only deals with capturing bytes.
 */

export interface SessionRecording {
  video: Blob;
  audio: Blob;
}

function pickMime(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

const VIDEO_MIME = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const AUDIO_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export class SessionRecorder {
  private videoRec?: MediaRecorder;
  private audioRec?: MediaRecorder;
  private videoChunks: Blob[] = [];
  private audioChunks: Blob[] = [];

  constructor(private readonly stream: MediaStream) {}

  start(): void {
    const videoMime = pickMime(VIDEO_MIME);
    this.videoRec = new MediaRecorder(this.stream, videoMime ? { mimeType: videoMime } : undefined);
    this.videoRec.ondataavailable = (e) => e.data.size && this.videoChunks.push(e.data);
    this.videoRec.start(1000);

    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length) {
      const audioStream = new MediaStream(audioTracks);
      const audioMime = pickMime(AUDIO_MIME);
      this.audioRec = new MediaRecorder(
        audioStream,
        audioMime ? { mimeType: audioMime } : undefined,
      );
      this.audioRec.ondataavailable = (e) => e.data.size && this.audioChunks.push(e.data);
      this.audioRec.start(1000);
    }
  }

  async stop(): Promise<SessionRecording> {
    const stopOne = (rec?: MediaRecorder) =>
      new Promise<void>((resolve) => {
        if (!rec || rec.state === 'inactive') return resolve();
        rec.onstop = () => resolve();
        rec.stop();
      });

    await Promise.all([stopOne(this.videoRec), stopOne(this.audioRec)]);

    const video = new Blob(this.videoChunks, {
      type: this.videoRec?.mimeType || 'video/webm',
    });
    const audio = this.audioChunks.length
      ? new Blob(this.audioChunks, { type: this.audioRec?.mimeType || 'audio/webm' })
      : video; // fall back to the muxed file if no separate audio track existed
    return { video, audio };
  }
}
