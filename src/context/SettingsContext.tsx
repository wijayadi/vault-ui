import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UiSettings {
  themeMode: ThemeMode;
  useRootKey: boolean;
  rootKey: string;
  capabilityCache: boolean;
  confirmDelete: boolean;
  diffAnnotations: boolean;
}

interface SettingsContextValue {
  settings: UiSettings;
  updateSettings: (patch: Partial<UiSettings>) => void;
}

const STORAGE_KEY = 'vault-ui:settings';

const defaultSettings: UiSettings = {
  themeMode: 'system',
  useRootKey: false,
  rootKey: '',
  capabilityCache: true,
  confirmDelete: true,
  diffAnnotations: true,
};

function readSettings(): UiSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<UiSettings>) };
  } catch {
    return defaultSettings;
  }
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UiSettings>(readSettings);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage is optional.
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<UiSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}

/** Resolves the "system" theme mode using the browser preference. */
export function useResolvedThemeMode(): 'light' | 'dark' {
  const { settings } = useSettings();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  if (settings.themeMode === 'system') return systemDark ? 'dark' : 'light';
  return settings.themeMode;
}
