export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: unknown };

export interface VaultConnection {
  url: string;
  token: string;
  namespace: string;
  timeoutMs?: number;
}

export interface VaultResponse<T = unknown> {
  request_id?: string;
  lease_id?: string;
  renewable?: boolean;
  lease_duration?: number;
  data?: T;
  wrap_info?: WrapInfo | null;
  warnings?: string[] | null;
  auth?: AuthInfo | null;
}

export interface AuthInfo {
  client_token: string;
  accessor?: string;
  policies?: string[];
  token_policies?: string[];
  metadata?: Record<string, string>;
  lease_duration?: number;
  renewable?: boolean;
  entity_id?: string;
  orphan?: boolean;
}

export interface WrapInfo {
  token: string;
  accessor?: string;
  ttl?: number;
  creation_time?: string;
  creation_path?: string;
  wrapped_accessor?: string;
}

export interface TokenIdentity {
  id?: string;
  accessor?: string;
  display_name?: string;
  policies?: string[];
  token_policies?: string[];
  meta?: Record<string, string>;
  ttl?: number;
  creation_ttl?: number;
  period?: number;
  renewable?: boolean;
  orphan?: boolean;
  entity_id?: string;
  last_renewal_time?: number;
  expire_time?: string | null;
  num_uses?: number;
}

export interface MountInfo {
  path: string;
  type: string;
  description: string;
  options: Record<string, string>;
  config?: Record<string, unknown>;
  accessor?: string;
  local?: boolean;
  seal_wrap?: boolean;
  external_entropy_access?: boolean;
}

export interface HealthStatus {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  performance_standby?: boolean;
  replication_performance_mode?: string;
  replication_dr_mode?: string;
  server_time_utc?: number;
  version: string;
  cluster_name?: string;
  cluster_id?: string;
  seal_type?: string;
  n?: number;
  t?: number;
  progress?: number;
  nonce?: string;
  type?: string;
  storage_type?: string;
  ha_enabled?: boolean;
  is_self?: boolean;
  active_time?: string;
  leader_address?: string;
}

export interface SecretReadResult {
  data: Record<string, unknown>;
  metadata: {
    created_time?: string;
    custom_metadata?: Record<string, string> | null;
    deletion_time?: string;
    destroyed?: boolean;
    version?: number;
    current_version?: number;
    max_versions?: number;
    cas_required?: boolean;
    delete_version_after?: string;
    versions?: Record<string, { created_time: string; deletion_time: string; destroyed: boolean }>;
  } | null;
  version: number | null;
}

export interface ServerConfig {
  version?: string;
  defaultVaultUrl: string;
  defaultVaultUrlForce: boolean;
  defaultAuthMethod: string;
  defaultAuthMethodForce: boolean;
  defaultBackendPath: string;
  defaultBackendPathForce: boolean;
  defaultNamespace: string;
  suppliedAuthToken: string;
}
