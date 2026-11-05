import { useEffect, useMemo, useState } from 'react';
import type { TokenIdentity } from '../api/types';

/** Returns the remaining token lifetime in seconds, updated every second. */
export function useTtlCountdown(identity: TokenIdentity | null): number | null {
  const expiresAt = useMemo(() => {
    if (!identity?.ttl || identity.ttl <= 0) return null;
    const renewedAt = identity.last_renewal_time ? identity.last_renewal_time * 1000 : Date.now();
    return renewedAt + identity.ttl * 1000;
  }, [identity]);

  const [remaining, setRemaining] = useState<number | null>(() =>
    expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : null,
  );

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }

    const update = () => setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}

export function formatTtl(seconds: number | null): string {
  if (seconds === null) return 'no expiry';
  if (seconds <= 0) return 'expired';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
