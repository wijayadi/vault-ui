import type { FieldDef } from '../config/authBackends';

export type FieldValues = Record<string, unknown>;

export function valuesFromPayload(
  fields: FieldDef[],
  payload: Record<string, unknown> | undefined,
): FieldValues {
  const values: FieldValues = {};
  for (const field of fields) {
    const raw = payload?.[field.key];
    switch (field.type) {
      case 'csv':
        values[field.key] = Array.isArray(raw) ? raw.join(', ') : (raw ?? '');
        break;
      case 'number':
        values[field.key] = raw === undefined || raw === null ? '' : String(raw);
        break;
      case 'boolean':
        values[field.key] = Boolean(raw ?? field.defaultValue ?? false);
        break;
      case 'policies':
        values[field.key] = Array.isArray(raw)
          ? raw.map(String)
          : raw
            ? String(raw).split(',').filter(Boolean)
            : [];
        break;
      case 'json':
        values[field.key] = raw ?? {};
        break;
      case 'password':
        values[field.key] = '';
        break;
      default:
        values[field.key] = raw ?? '';
    }
  }
  return values;
}

function coerce(field: FieldDef, value: unknown): unknown {
  switch (field.type) {
    case 'csv':
      if (Array.isArray(value)) return value.map(String).filter(Boolean);
      return String(value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    case 'number':
      return value === '' || value === undefined ? undefined : Number(value);
    case 'boolean':
      return Boolean(value);
    case 'policies':
      return Array.isArray(value) ? value.map(String) : [];
    case 'json':
      return value ?? {};
    default:
      return value === '' || value === undefined ? undefined : value;
  }
}

export function payloadFromValues(fields: FieldDef[], values: FieldValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'policies') continue;
    const value = coerce(field, values[field.key]);
    if (value === undefined) continue;
    if (field.type === 'json' && Object.keys(value as object).length === 0) continue;
    payload[field.key] = value;
  }
  return payload;
}

export function defaultValues(fields: FieldDef[]): FieldValues {
  const values: FieldValues = {};
  for (const field of fields) {
    switch (field.type) {
      case 'policies':
        values[field.key] = [];
        break;
      case 'boolean':
        values[field.key] = Boolean(field.defaultValue ?? false);
        break;
      case 'json':
        values[field.key] = {};
        break;
      default:
        values[field.key] = field.defaultValue ?? '';
    }
  }
  return values;
}
