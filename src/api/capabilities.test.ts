import { describe, expect, it } from 'vitest';
import { evaluateCapabilities } from './capabilities';

describe('evaluateCapabilities', () => {
  it('requires every capability', () => {
    expect(evaluateCapabilities(['read', 'list'], ['read'])).toBe(true);
    expect(evaluateCapabilities(['read'], ['read', 'list'])).toBe(false);
  });

  it('treats root as a wildcard', () => {
    expect(evaluateCapabilities(['root'], ['sudo', 'delete'])).toBe(true);
  });

  it('returns false for empty or missing capabilities', () => {
    expect(evaluateCapabilities([], ['read'])).toBe(false);
    expect(evaluateCapabilities(undefined, ['read'])).toBe(false);
  });

  it('supports deny-style capability names without matching them grammatically', () => {
    expect(evaluateCapabilities(['deny'], ['read'])).toBe(false);
  });
});
