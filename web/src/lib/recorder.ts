/**
 * Captures the work session: full camera+mic video plus a parallel audio-only
 * track (so the detail page can play either). Both are produced as Blobs and
 * handed to the data layer for upload.
 */

export interface RecordedMedia {
  video: Blob;
  audio: Blob;
}

function pickType(candidates: string[]): string | undefined {
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export class SessionRecorder {
  private videoRecorder?: MediaRecorder;
  private audioRecorder?: MediaRecorder;
  private videoChunks: Blob[] = [];
  private audioChunks: Blob[] = [];
  private videoType = 'video/webm';
  private audioType = 'audio/webm';

  constructor(private stream: MediaStream) {}

  start(): void {
    this.videoType =
      pickType(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) ??
      'video/webm';
    this.audioType =
      pickType(['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']) ?? 'audio/webm';

    this.videoRecorder = new MediaRecorder(this.stream, { mimeType: this.videoType });
    this.videoRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.videoChunks.push(e.data);
    };
    this.videoRecorder.start(1000);

    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const audioStream = new MediaStream(audioTracks);
      this.audioRecorder = new MediaRecorder(audioStream, { mimeType: this.audioType });
      this.audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.audioRecorder.start(1000);
    }
  }

  async stop(): Promise<RecordedMedia> {
    const stopOne = (rec?: MediaRecorder) =>
      new Promise<void>((resolve) => {
        if (!rec || rec.state === 'inactive') return resolve();
        rec.onstop = () => resolve();
        rec.stop();
      });
    await Promise.all([stopOne(this.videoRecorder), stopOne(this.audioRecorder)]);
    return {
      video: new Blob(this.videoChunks, { type: this.videoType }),
      audio: new Blob(
        this.audioChunks.length ? this.audioChunks : this.videoChunks,
        { type: this.audioChunks.length ? this.audioType : this.videoType },
      ),
    };
  }
}

/** Request camera + microphone access. */
export async function openCameraMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: { echoCancellation: true, noiseSuppression: false },
  });
}
