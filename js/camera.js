// Webcam capture. Shows a live feed, then grabs a single still frame on capture so the
// heavy grade runs on a sharp frozen image rather than every video frame.

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    return this.video;
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  get ready() {
    return this.video.readyState >= 2 && this.video.videoWidth > 0;
  }

  // Freeze the current frame into a canvas we can grade and export.
  capture() {
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(this.video, 0, 0, w, h);
    return c;
  }
}
