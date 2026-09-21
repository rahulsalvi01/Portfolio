// Configuration
const FRAME_COUNT = 192;
const FRAME_PATH = (index) => `frames/frame_${String(index).padStart(4, '0')}.jpg`;
const LERP_FACTOR = 0.08; // Inertia smoothness

// DOM Elements
const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');
const loaderText = document.getElementById('loader-text');

// State
const images = new Array(FRAME_COUNT).fill(null);
const loadedFlags = new Array(FRAME_COUNT).fill(false);
let loadedCount = 0;
let targetFrame = 0;
let currentFrame = 0;
let lastRenderedIndex = -1;
let isReady = false;

// Setup Canvas Dimensions (Handling High-DPI displays)
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const displayWidth = window.innerWidth;
  const displayHeight = window.innerHeight;

  const targetWidth = Math.round(displayWidth * dpr);
  const targetHeight = Math.round(displayHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    if (lastRenderedIndex !== -1) {
      drawFrame(lastRenderedIndex);
    }
  }
}

// Draw Image with "object-fit: cover" centering
function drawFrame(index) {
  const img = getClosestLoadedImage(index);
  if (!img) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const ratio = Math.max(cw / iw, ch / ih);
  const renderW = iw * ratio;
  const renderH = ih * ratio;
  const x = (cw - renderW) * 0.5;
  const y = (ch - renderH) * 0.5;

  ctx.drawImage(img, 0, 0, iw, ih, x, y, renderW, renderH);
  lastRenderedIndex = index;
}

// Fallback to nearest loaded image if target frame is still downloading
function getClosestLoadedImage(targetIdx) {
  if (images[targetIdx] && loadedFlags[targetIdx]) {
    return images[targetIdx];
  }

  // Scan outwards for the nearest available frame
  for (let offset = 1; offset < FRAME_COUNT; offset++) {
    const prev = targetIdx - offset;
    if (prev >= 0 && images[prev] && loadedFlags[prev]) {
      return images[prev];
    }
    const next = targetIdx + offset;
    if (next < FRAME_COUNT && images[next] && loadedFlags[next]) {
      return images[next];
    }
  }

  return null;
}

// Update scroll target frame based on page scroll position
function updateScrollTarget() {
  const scrollTop = window.scrollY || window.pageYOffset;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  
  if (maxScroll <= 0) {
    targetFrame = 0;
    return;
  }

  const progress = Math.max(0, Math.min(1, scrollTop / maxScroll));
  targetFrame = progress * (FRAME_COUNT - 1);
}

// Preload single frame
function loadFrame(i) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = FRAME_PATH(i + 1);

    const onFinish = () => {
      images[i] = img;
      loadedFlags[i] = true;
      loadedCount++;

      // Render first frame as early as possible
      if (i === 0 && !isReady) {
        drawFrame(0);
      }

      resolve();
    };

    img.onload = onFinish;
    img.onerror = () => {
      console.warn(`Could not load frame ${i + 1}`);
      resolve();
    };
  });
}

// Progressive Preloading
async function preloadImages() {
  // Smooth 2-second fake loading animation
  let fakeProgress = 0;
  const interval = setInterval(() => {
    fakeProgress += 1;
    if (fakeProgress > 100) fakeProgress = 100;
    
    if (loaderProgress) loaderProgress.style.width = `${fakeProgress}%`;
    if (loaderText) loaderText.textContent = `Loading experience... ${fakeProgress}%`;
    
    if (fakeProgress >= 100) {
      clearInterval(interval);
      if (!isReady) markReady();
    }
  }, 20); // 20ms * 100 = 2000ms (2 seconds)

  // 1. Immediately load frame 1 for instant visual display
  await loadFrame(0);
  drawFrame(0);

  // 2. Load the remaining frames concurrently in batches (background loading)
  const BATCH_SIZE = 12;
  for (let i = 1; i < FRAME_COUNT; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, FRAME_COUNT); j++) {
      batch.push(loadFrame(j));
    }
    await Promise.all(batch);
  }
}

function markReady() {
  isReady = true;
  if (loader) {
    loader.classList.add('loaded');
  }
}

// Main Animation Loop with Inertial Smoothing (LERP)
function animationLoop() {
  const diff = targetFrame - currentFrame;

  if (Math.abs(diff) > 0.001) {
    currentFrame += diff * LERP_FACTOR;
    const frameToDraw = Math.round(currentFrame);
    if (frameToDraw !== lastRenderedIndex) {
      drawFrame(frameToDraw);
    }
  }

  requestAnimationFrame(animationLoop);
}

// Initialize
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', updateScrollTarget, { passive: true });

  preloadImages();
  updateScrollTarget();
  requestAnimationFrame(animationLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
