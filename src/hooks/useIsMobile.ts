import { useSyncExternalStore } from 'react';
import { isMobileDevice } from '../lib/isMobileDevice';

function subscribe(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)');

  mediaQuery.addEventListener('change', onStoreChange);
  window.addEventListener('resize', onStoreChange);
  window.addEventListener('orientationchange', onStoreChange);

  return () => {
    mediaQuery.removeEventListener('change', onStoreChange);
    window.removeEventListener('resize', onStoreChange);
    window.removeEventListener('orientationchange', onStoreChange);
  };
}

function getSnapshot() {
  return isMobileDevice();
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
