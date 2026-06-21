const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 256;
const JPEG_QUALITY = 0.85;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export class AvatarImageError extends Error {
  constructor(public readonly code: 'invalid_type' | 'too_large' | 'processing_failed') {
    super(code);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new AvatarImageError('processing_failed'));
      }
    };
    reader.onerror = () => reject(new AvatarImageError('processing_failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new AvatarImageError('processing_failed'));
    image.src = dataUrl;
  });
}

async function resizeImage(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new AvatarImageError('processing_failed');
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export async function processAvatarFile(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new AvatarImageError('invalid_type');
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarImageError('too_large');
  }

  const dataUrl = await readFileAsDataUrl(file);
  return resizeImage(dataUrl);
}
