/**
 * Grabs the current frame from a video element and returns it as a base64 JPEG
 * @param {HTMLVideoElement} video - The video element
 * @param {HTMLCanvasElement} canvas - Canvas element for frame extraction
 * @returns {string|null} Base64 encoded JPEG image or null if video not ready
 */
export function grabFrame(video, canvas) {
  if (!video.videoWidth) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.55);
}
