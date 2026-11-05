import { describe, expect, it } from 'vitest';
import { isValidVaultUrl, normalizeVaultUrl, unwrap, unwrapErrors } from './client';

describe('client helpers', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeVaultUrl('https://vault.example.com:8200/')).toBe('https://vault.example.com:8200');
    expect(normalizeVaultUrl('  http://localhost:8200//  ')).toBe('http://localhost:8200');
  });

  it('validates http and https URLs only', () => {
    expect(isValidVaultUrl('https://vault.example.com')).toBe(true);
    expect(isValidVaultUrl('http://localhost:8200')).toBe(true);
    expect(isValidVaultUrl('vault.example.com')).toBe(false);
    expect(isValidVaultUrl('ftp://vault.example.com')).toBe(false);
    expect(isValidVaultUrl('')).toBe(false);
  });

  it('unwraps Vault response envelopes', () => {
    expect(unwrap<{ value: number }>({ data: { value: 1 } })).toEqual({ value: 1 });
    expect(unwrap({ value: 1 })).toEqual({ value: 1 });
  });

  it('reads errors from Vault responses', () => {
    expect(unwrapErrors({ errors: ['permission denied', 'bad token'] })).toEqual([
      'permission denied',
      'bad token',
    ]);
    expect(unwrapErrors({})).toEqual([]);
  });
});
