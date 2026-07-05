// ============================================================
//  GPL Online — Face Processor (face-api.js)
// ============================================================

// face-api.js loaded from CDN (injected into HTML via script tag)
// We use the global `faceapi` object

const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

let modelsLoaded = false;
let loadingPromise = null;

export async function loadFaceModels(onProgress) {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      if (typeof faceapi === 'undefined') {
        console.warn('face-api.js not loaded. Face detection unavailable.');
        return false;
      }

      onProgress?.('Loading face detection model...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      onProgress?.('Loading face landmark model...');
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
      modelsLoaded = true;
      onProgress?.('Face models ready!');
      return true;
    } catch (err) {
      console.warn('Face model loading failed:', err);
      return false;
    }
  })();

  return loadingPromise;
}

/**
 * Detects face in an image element and returns a cropped face canvas.
 * Returns null if no face detected or face-api not available.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imgEl
 * @returns {Promise<HTMLCanvasElement|null>}
 */
export async function detectAndCropFace(imgEl) {
  if (!modelsLoaded || typeof faceapi === 'undefined') return null;

  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
    const result  = await faceapi.detectSingleFace(imgEl, options).withFaceLandmarks(true);

    if (!result) return null;

    const { box } = result.detection;
    const landmarks = result.landmarks;

    // Add generous padding to include hair, ears, forehead
    const padX = box.width  * 0.45;
    const padY = box.height * 0.55;

    const sx = Math.max(0, box.x - padX);
    const sy = Math.max(0, box.y - padY);
    const sw = Math.min(imgEl.naturalWidth  || imgEl.width,  box.width  + padX * 2);
    const sh = Math.min(imgEl.naturalHeight || imgEl.height, box.height + padY * 2);

    // Crop onto a square canvas
    const size   = Math.max(sw, sh);
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      imgEl,
      sx, sy, sw, sh,
      0, 0, 256, 256,
    );

    // Store landmark positions relative to cropped region (normalized 0-1)
    const relLandmarks = computeRelativeLandmarks(landmarks, sx, sy, sw, sh);
    canvas._landmarks = relLandmarks;
    canvas._hasFace   = true;

    return canvas;
  } catch (err) {
    console.warn('Face detection error:', err);
    return null;
  }
}

/**
 * Returns a simple crop canvas from the center of the image (fallback).
 */
export function cropCenterFace(imgEl) {
  const canvas = document.createElement('canvas');
  canvas.width  = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const srcW = imgEl.naturalWidth  || imgEl.width;
  const srcH = imgEl.naturalHeight || imgEl.height;
  const size  = Math.min(srcW, srcH);
  const sx    = (srcW - size) / 2;
  const sy    = (srcH - size) / 3; // slightly above center (face tends to be upper half)

  ctx.drawImage(imgEl, sx, sy, size, size, 0, 0, 256, 256);
  canvas._hasFace   = false;
  canvas._landmarks = null;
  return canvas;
}

function computeRelativeLandmarks(landmarks, sx, sy, sw, sh) {
  const pts = landmarks.positions;

  // Key landmarks: left eye (36-41), right eye (42-47), nose (27-35), mouth (48-67)
  const leftEyeCenter  = centroid(pts.slice(36, 42));
  const rightEyeCenter = centroid(pts.slice(42, 48));
  const noseTip        = pts[30];
  const mouthCenter    = centroid(pts.slice(48, 60));

  const normalize = (pt) => ({
    x: (pt.x - sx) / sw,
    y: (pt.y - sy) / sh,
  });

  return {
    leftEye:  normalize(leftEyeCenter),
    rightEye: normalize(rightEyeCenter),
    nose:     normalize(noseTip),
    mouth:    normalize(mouthCenter),
  };
}

function centroid(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Load an image URL and return an HTMLImageElement
 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
