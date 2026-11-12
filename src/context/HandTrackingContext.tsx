import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'enablecode.handTrackingEnabled';

interface HandTrackingContextValue {
  isEnabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
}

const HandTrackingContext = createContext<HandTrackingContextValue | undefined>(undefined);

interface HandTrackingProviderProps {
  children: ReactNode;
}

export function HandTrackingProvider({ children }: HandTrackingProviderProps) {
  const [isEnabled, setIsEnabled] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true',
  );

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, []);

  const toggle = useCallback(() => {
    setIsEnabled(previous => {
      const next = !previous;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <HandTrackingContext.Provider value={{ isEnabled, toggle, setEnabled }}>{children}</HandTrackingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHandTracking() {
  const context = useContext(HandTrackingContext);
  if (!context) {
    throw new Error('useHandTracking must be used within a HandTrackingProvider');
  }
  return context;
}
