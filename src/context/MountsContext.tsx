import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { listAuthMounts, listMounts, listVisibleMounts } from '../api/system';
import { errorMessage } from './ToastContext';
import type { MountInfo, VaultConnection } from '../api/types';

interface MountsState {
  mounts: MountInfo[];
  authMounts: MountInfo[];
  error: string | null;
}

interface MountsContextValue extends MountsState {
  loading: boolean;
  refresh: () => Promise<void>;
}

const MountsContext = createContext<MountsContextValue | null>(null);

async function loadAllMounts(connection: VaultConnection): Promise<MountsState> {
  try {
    const [mounts, authMounts] = await Promise.all([listMounts(connection), listAuthMounts(connection)]);
    return { mounts, authMounts, error: null };
  } catch (error) {
    try {
      const visible = await listVisibleMounts(connection);
      return { mounts: visible.secrets, authMounts: visible.auth, error: null };
    } catch {
      return {
        mounts: [],
        authMounts: [],
        error: errorMessage(error),
      };
    }
  }
}

export function MountsProvider({ children }: { children: ReactNode }) {
  const { connection } = useAuth();
  const [state, setState] = useState<MountsState>({ mounts: [], authMounts: [], error: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await loadAllMounts(connection);
    setState(next);
    setLoading(false);
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<MountsContextValue>(
    () => ({ ...state, loading, refresh }),
    [state, loading, refresh],
  );

  return <MountsContext.Provider value={value}>{children}</MountsContext.Provider>;
}

export function useMounts(): MountsContextValue {
  const context = useContext(MountsContext);
  if (!context) throw new Error('useMounts must be used inside MountsProvider');
  return context;
}
