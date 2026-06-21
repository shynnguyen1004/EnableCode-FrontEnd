export function getEyeTrackingShortcutLabel() {
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMac ? 'CMD + M' : 'Ctrl + M';
}
