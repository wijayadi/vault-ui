import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    request: (...args: unknown[]) => request(...args),
    isAxiosError: () => false,
  },
}));

import { vaultRequest } from './client';

const connection = { url: 'https://vault.example.com', token: 'token', namespace: '' };

describe('vaultRequest HTTP status handling', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: { ok: true } });
  });

  it('rejects non-2xx responses unless the caller opts out', async () => {
    await vaultRequest(connection, 'get', 'sys/mounts');

    const config = request.mock.calls[0][0] as { validateStatus?: (status: number) => boolean };
    expect(config.validateStatus).toBeTypeOf('function');
    expect(config.validateStatus?.(200)).toBe(true);
    expect(config.validateStatus?.(204)).toBe(true);
    expect(config.validateStatus?.(403)).toBe(false);
    expect(config.validateStatus?.(502)).toBe(false);
  });

  it('preserves an explicit validateStatus function for health checks', async () => {
    const validateStatus = (status: number) => status > 0 && status < 600;
    await vaultRequest(connection, 'get', 'sys/health', { validateStatus });

    const config = request.mock.calls[0][0] as { validateStatus?: (status: number) => boolean };
    expect(config.validateStatus).toBe(validateStatus);
  });
});
