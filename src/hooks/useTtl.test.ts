import { describe, expect, it } from 'vitest';
import { formatTtl } from './useTtl';

describe('formatTtl', () => {
  it('formats sub-minute values', () => {
    expect(formatTtl(45)).toBe('45s');
    expect(formatTtl(0)).toBe('expired');
  });

  it('formats minutes and hours', () => {
    expect(formatTtl(125)).toBe('2m 5s');
    expect(formatTtl(3661)).toBe('1h 1m');
  });

  it('formats days', () => {
    expect(formatTtl(90061)).toBe('1d 1h');
  });

  it('handles unknown expiry', () => {
    expect(formatTtl(null)).toBe('no expiry');
  });
});
