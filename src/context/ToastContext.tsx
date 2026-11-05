import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { VaultApiError } from '../api/client';

type Severity = 'success' | 'info' | 'warning' | 'error';

interface ToastMessage {
  id: number;
  message: string;
  severity: Severity;
}

interface ToastContextValue {
  notify: (message: string, severity?: Severity) => void;
  notifyError: (error: unknown) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function errorMessage(error: unknown): string {
  if (error instanceof VaultApiError) return error.errors.join(', ') || error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastMessage[]>([]);

  const notify = useCallback((message: string, severity: Severity = 'success') => {
    setQueue((items) => [...items, { id: Date.now() + Math.random(), message, severity }]);
  }, []);

  const notifyError = useCallback(
    (error: unknown) => {
      notify(errorMessage(error), 'error');
    },
    [notify],
  );

  const handleClose = useCallback(() => {
    setQueue((items) => items.slice(1));
  }, []);

  const active = queue[0] ?? null;
  const value = useMemo(() => ({ notify, notifyError }), [notify, notifyError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={active?.id}
        open={Boolean(active)}
        autoHideDuration={active?.severity === 'error' ? 8000 : 4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={active?.severity ?? 'info'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {active?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
