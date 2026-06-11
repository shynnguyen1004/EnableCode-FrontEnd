const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

const MOBILE_MAX_WIDTH_PX = 768;

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent)) {
    return true;
  }

  const isNarrowViewport = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`).matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  return isNarrowViewport && isCoarsePointer;
}
