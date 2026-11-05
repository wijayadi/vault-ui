import { describe, expect, it } from 'vitest';
import { isDirectoryPath, joinLogicalPath, kvDataPath, kvDeletePath, kvMetadataPath, kvVersion } from './kv';
import type { MountInfo } from './types';

const kv2: MountInfo = {
  path: 'secret/',
  type: 'kv',
  description: '',
  options: { version: '2' },
};

const kv1: MountInfo = {
  path: 'kv/',
  type: 'kv',
  description: '',
  options: {},
};

const generic: MountInfo = {
  path: 'legacy/',
  type: 'generic',
  description: '',
  options: {},
};

describe('KV path helpers', () => {
  it('detects KV versions', () => {
    expect(kvVersion(kv2)).toBe(2);
    expect(kvVersion(kv1)).toBe(1);
    expect(kvVersion(generic)).toBe(1);
  });

  it('builds data paths for KV v2 and v1', () => {
    expect(kvDataPath(kv2, 'apps/web')).toBe('secret/data/apps/web');
    expect(kvDataPath(kv1, 'apps/web')).toBe('kv/apps/web');
    expect(kvDataPath(kv2, '/apps/web')).toBe('secret/data/apps/web');
  });

  it('builds metadata and delete paths', () => {
    expect(kvMetadataPath(kv2, 'apps/web')).toBe('secret/metadata/apps/web');
    expect(kvMetadataPath(kv1, 'apps/web')).toBe('kv/apps/web');
    expect(kvDeletePath(kv2, 'apps/web', 'delete')).toBe('secret/delete/apps/web');
    expect(kvDeletePath(kv2, 'apps/web', 'undelete')).toBe('secret/undelete/apps/web');
    expect(kvDeletePath(kv2, 'apps/web', 'destroy')).toBe('secret/destroy/apps/web');
  });

  it('joins logical paths without duplicate separators', () => {
    expect(joinLogicalPath('secret/', '/apps/', '/web')).toBe('secret/apps/web');
    expect(joinLogicalPath('', '', '')).toBe('');
  });

  it('detects directory paths', () => {
    expect(isDirectoryPath('')).toBe(true);
    expect(isDirectoryPath('apps/')).toBe(true);
    expect(isDirectoryPath('apps/web')).toBe(false);
  });
});
