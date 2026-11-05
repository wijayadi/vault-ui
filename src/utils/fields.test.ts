import { describe, expect, it } from 'vitest';
import { defaultValues, payloadFromValues, valuesFromPayload } from './fields';
import type { FieldDef } from '../config/authBackends';

const fields: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'ttl', label: 'TTL', type: 'number' },
  { key: 'renewable', label: 'Renewable', type: 'boolean' },
  { key: 'cidrs', label: 'CIDRs', type: 'csv' },
  { key: 'policies', label: 'Policies', type: 'policies' },
  { key: 'secret', label: 'Secret', type: 'password', writeOnly: true },
  { key: 'config', label: 'Config', type: 'json' },
];

describe('field conversion helpers', () => {
  it('converts payloads into editable values', () => {
    const values = valuesFromPayload(fields, {
      name: 'role',
      ttl: 60,
      renewable: true,
      cidrs: ['10.0.0.0/8'],
      policies: ['default', 'app'],
      secret: 'should-not-leak',
      config: { a: 1 },
    });

    expect(values.name).toBe('role');
    expect(values.ttl).toBe('60');
    expect(values.renewable).toBe(true);
    expect(values.cidrs).toBe('10.0.0.0/8');
    expect(values.policies).toEqual(['default', 'app']);
    expect(values.secret).toBe('');
    expect(values.config).toEqual({ a: 1 });
  });

  it('converts editable values into a Vault payload', () => {
    const payload = payloadFromValues(fields, {
      name: 'role',
      ttl: '60',
      renewable: true,
      cidrs: '10.0.0.0/8, 192.168.0.0/16',
      policies: ['default'],
      secret: '',
      config: {},
    });

    expect(payload).toEqual({
      name: 'role',
      ttl: 60,
      renewable: true,
      cidrs: ['10.0.0.0/8', '192.168.0.0/16'],
    });
  });

  it('omits empty write-only secrets and empty JSON', () => {
    const payload = payloadFromValues(fields, {
      secret: '',
      config: {},
    });
    expect(payload).toEqual({ renewable: false, cidrs: [] });
  });

  it('provides sensible defaults', () => {
    const values = defaultValues(fields);
    expect(values.policies).toEqual([]);
    expect(values.renewable).toBe(false);
    expect(values.config).toEqual({});
  });
});
