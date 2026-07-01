const COOKIE_NAME = 'enablecode.cameraPermissionGranted';
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function hasCameraPermissionCookie(): boolean {
  return document.cookie.split(';').some(entry => entry.trim().startsWith(`${COOKIE_NAME}=true`));
}

export function setCameraPermissionCookie(): void {
  document.cookie = `${COOKIE_NAME}=true; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

export type CameraPermissionResult = 'granted' | 'denied' | 'unsupported';

export async function requestCameraPermission(): Promise<CameraPermissionResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return 'granted';
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
      return 'denied';
    }
    return 'unsupported';
  }
}
