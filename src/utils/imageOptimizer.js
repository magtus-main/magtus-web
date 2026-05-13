/**
 * Centralized Image Optimizer
 * WhatsApp-style compression: resize + quality reduction
 * Target: < 2MB while maintaining good visual quality
 */

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_DIMENSION = 1920; // Max width/height in pixels
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.05;

/**
 * Creates a local preview URL from a File object.
 * Call URL.revokeObjectURL() when no longer needed.
 * @param {File} file
 * @returns {string} Object URL for immediate preview
 */
export function createPreviewUrl(file) {
  return URL.createObjectURL(file);
}

/**
 * Loads an image from a File into an HTMLImageElement.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
    // Cleanup after load
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
  });
}

/**
 * Calculates new dimensions maintaining aspect ratio.
 * @param {number} width 
 * @param {number} height 
 * @param {number} maxDim 
 * @returns {{ width: number, height: number }}
 */
function calculateDimensions(width, height, maxDim) {
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }
  const ratio = Math.min(maxDim / width, maxDim / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Compresses an image using Canvas API (WhatsApp-style).
 * 
 * Strategy:
 * 1. Resize to max 1920px on longest side
 * 2. Convert to WebP (best compression) with fallback to JPEG
 * 3. Progressively reduce quality until < 2MB
 * 
 * @param {File} file - Original image file
 * @param {object} options
 * @param {number} [options.maxSize=2097152] - Max file size in bytes (default 2MB)
 * @param {number} [options.maxDimension=1920] - Max pixel dimension
 * @param {number} [options.initialQuality=0.85] - Starting compression quality
 * @returns {Promise<File>} Optimized image file
 */
export async function optimizeImage(file, options = {}) {
  const {
    maxSize = MAX_FILE_SIZE,
    maxDimension = MAX_DIMENSION,
    initialQuality = INITIAL_QUALITY,
  } = options;

  // If already small enough and not too large dimension-wise, return as-is
  if (file.size <= maxSize && file.type !== 'image/bmp' && file.type !== 'image/tiff') {
    // Still check dimensions
    const img = await loadImage(file);
    if (img.width <= maxDimension && img.height <= maxDimension) {
      return file;
    }
  }

  const img = await loadImage(file);
  const { width, height } = calculateDimensions(img.width, img.height, maxDimension);

  // Create canvas for resizing
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Try WebP first (better compression), fallback to JPEG
  const outputType = 'image/webp';
  const fallbackType = 'image/jpeg';
  
  let quality = initialQuality;
  let blob;

  // Progressive quality reduction until under maxSize
  while (quality >= MIN_QUALITY) {
    blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, quality));
    
    // If browser doesn't support WebP toBlob, try JPEG
    if (!blob || blob.type !== outputType) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, fallbackType, quality));
    }

    if (blob && blob.size <= maxSize) {
      break;
    }

    quality -= QUALITY_STEP;
  }

  // If still too large after minimum quality, scale down further
  if (blob && blob.size > maxSize) {
    const scaleFactor = Math.sqrt(maxSize / blob.size) * 0.9;
    canvas.width = Math.round(width * scaleFactor);
    canvas.height = Math.round(height * scaleFactor);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, MIN_QUALITY));
    if (!blob || blob.type !== outputType) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, fallbackType, MIN_QUALITY));
    }
  }

  // Generate filename with proper extension
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const optimizedFile = new File([blob], `${baseName}.${ext}`, {
    type: blob.type,
    lastModified: Date.now(),
  });

  return optimizedFile;
}

/**
 * Handles a file input: creates preview + prepares for later optimization.
 * Returns an image object with local preview and the original file.
 * Call optimizeImage() on the file at upload time.
 * 
 * @param {File} file - File from input[type=file]
 * @param {boolean} isPrimary - Whether this should be the primary image
 * @returns {{ file: File, url: string, isExisting: boolean, is_primary: boolean }}
 */
export function prepareImageForPreview(file, isPrimary = false) {
  return {
    file,
    url: createPreviewUrl(file),
    isExisting: false,
    is_primary: isPrimary,
  };
}
