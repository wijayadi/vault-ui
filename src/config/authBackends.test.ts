import { describe, expect, it } from 'vitest';
import { AUTH_BACKENDS, AUTH_BACKEND_TYPES } from './authBackends';
import { LOGIN_METHODS } from './loginMethods';

describe('auth backend definitions', () => {
  it('defines unique backend types', () => {
    expect(new Set(AUTH_BACKEND_TYPES).size).toBe(AUTH_BACKEND_TYPES.length);
  });

  it('every backend has at least one collection or a config section', () => {
    for (const [key, backend] of Object.entries(AUTH_BACKENDS)) {
      expect(backend.type, key).toBe(key);
      expect(backend.collections.length + (backend.config ? 1 : 0), key).toBeGreaterThan(0);
    }
  });

  it('every collection has a policies field or a policies key', () => {
    for (const backend of Object.values(AUTH_BACKENDS)) {
      for (const collection of backend.collections) {
        const hasPoliciesField = collection.fields.some((field) => field.type === 'policies');
        expect(hasPoliciesField || Boolean(collection.policiesKey), `${backend.type}/${collection.key}`).toBe(
          true,
        );
      }
    }
  });

  it('collection keys are unique within a backend', () => {
    for (const backend of Object.values(AUTH_BACKENDS)) {
      const keys = backend.collections.map((collection) => collection.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('login method definitions', () => {
  it('has unique IDs and non-empty fields', () => {
    expect(new Set(LOGIN_METHODS.map((method) => method.id)).size).toBe(LOGIN_METHODS.length);
    for (const method of LOGIN_METHODS) {
      expect(method.fields.length, method.id).toBeGreaterThan(0);
      expect(method.defaultPath, method.id).not.toBe('');
    }
  });

  it('marks OIDC as a redirect flow', () => {
    expect(LOGIN_METHODS.find((method) => method.id === 'OIDC')?.oidc).toBe(true);
  });
});
