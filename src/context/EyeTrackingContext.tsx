import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getEyeTrackingShortcutLabel } from '../lib/eyeTrackingShortcut';

const STORAGE_KEY = 'enablecode.eyeTrackingEnabled';

interface EyeTrackingContextType {
  isEnabled: boolean;
  toggle: () => void;
  shortcutLabel: string;
}

const EyeTrackingContext = createContext<EyeTrackingContextType | undefined>(undefined);

interface EyeTrackingProviderProps {
  children: ReactNode;
}

export function EyeTrackingProvider({ children }: EyeTrackingProviderProps) {
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const shortcutLabel = getEyeTrackingShortcutLabel();

  const toggle = useCallback(() => {
    setIsEnabled(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm') return;
      if (!e.metaKey && !e.ctrlKey) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      e.preventDefault();
      toggle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return (
    <EyeTrackingContext.Provider value={{ isEnabled, toggle, shortcutLabel }}>{children}</EyeTrackingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEyeTracking = () => {
  const context = useContext(EyeTrackingContext);
  if (context === undefined) {
    throw new Error('useEyeTracking must be used within an EyeTrackingProvider');
  }
  return context;
};
