export type FieldType = 'text' | 'password' | 'number' | 'boolean' | 'csv' | 'json' | 'select' | 'policies';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Secrets are never pre-filled when editing. */
  writeOnly?: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
}

export interface AuthCollection {
  key: string;
  label: string;
  /** Path relative to auth/<mount>, e.g. "role", "users", "map/teams". */
  path: string;
  itemLabel: string;
  fields: FieldDef[];
  /** Where policies live in the payload. Defaults to "policies". */
  policiesKey?: string;
  /** GitHub-style maps store policies as a comma separated string in `value`. */
  policiesFormat?: 'array' | 'csv';
  /** Fields that are part of the path rather than the payload. */
  nameLabel?: string;
}

export interface AuthBackendDef {
  type: string;
  label: string;
  description: string;
  config?: {
    path: string;
    intro?: string;
    fields: FieldDef[];
  };
  collections: AuthCollection[];
  notes?: string[];
}

const ttlFields: FieldDef[] = [
  {
    key: 'ttl',
    label: 'Default TTL',
    type: 'text',
    placeholder: '1h',
    help: 'Duration string, e.g. 30m or 24h.',
  },
  {
    key: 'max_ttl',
    label: 'Maximum TTL',
    type: 'text',
    placeholder: '24h',
    help: 'Duration string, e.g. 24h.',
  },
];

const roleTtlFields: FieldDef[] = [
  { key: 'ttl', label: 'Token TTL', type: 'text', placeholder: '1h' },
  { key: 'max_ttl', label: 'Token Maximum TTL', type: 'text', placeholder: '24h' },
  { key: 'period', label: 'Period', type: 'text', placeholder: '12h' },
];

const policiesField: FieldDef = {
  key: 'policies',
  label: 'Policies',
  type: 'policies',
  help: 'Policies attached to tokens issued by this backend.',
};

/** Declarative descriptions of the auth backends Vault-UI can manage. */
export const AUTH_BACKENDS: Record<string, AuthBackendDef> = {
  approle: {
    type: 'approle',
    label: 'AppRole',
    description: 'Machine-to-machine authentication using Role IDs and Secret IDs.',
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          { key: 'bind_secret_id', label: 'Bind Secret ID', type: 'boolean', defaultValue: true },
          { key: 'secret_id_bound_cidrs', label: 'Secret ID bound CIDRs', type: 'csv' },
          { key: 'secret_id_num_uses', label: 'Secret ID uses', type: 'number', min: 0 },
          { key: 'secret_id_ttl', label: 'Secret ID TTL', type: 'text', placeholder: '0' },
          { key: 'token_num_uses', label: 'Token uses', type: 'number', min: 0 },
          { key: 'token_ttl', label: 'Token TTL', type: 'text' },
          { key: 'token_max_ttl', label: 'Token max TTL', type: 'text' },
          { key: 'period', label: 'Period', type: 'text' },
          { key: 'token_bound_cidrs', label: 'Token bound CIDRs', type: 'csv' },
          policiesField,
        ],
      },
    ],
    notes: [
      'Use the AppRole extras panel in the role editor to view/update the Role ID and issue Secret IDs.',
    ],
  },
  aws: {
    type: 'aws',
    label: 'AWS (IAM)',
    description: 'Authentication for AWS IAM principals.',
    config: {
      path: 'config/client',
      intro: 'Configure the credentials Vault uses to verify IAM identities.',
      fields: [
        { key: 'access_key', label: 'Access key', type: 'text' },
        { key: 'secret_key', label: 'Secret key', type: 'password', writeOnly: true },
        { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://sts.amazonaws.com' },
        { key: 'iam_endpoint', label: 'IAM endpoint', type: 'text' },
        { key: 'sts_endpoint', label: 'STS endpoint', type: 'text' },
        { key: 'sts_region', label: 'STS region', type: 'text', placeholder: 'us-east-1' },
      ],
    },
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          { key: 'bound_iam_principal_arn', label: 'Bound IAM principal ARN', type: 'text' },
          { key: 'bound_account_id', label: 'Bound account ID', type: 'text' },
          { key: 'bound_region', label: 'Bound region', type: 'text' },
          { key: 'role_tag', label: 'Role tag', type: 'text' },
          ...roleTtlFields,
          policiesField,
        ],
      },
    ],
  },
  'aws-ec2': {
    type: 'aws-ec2',
    label: 'AWS (EC2)',
    description: 'Authentication for AWS EC2 instances.',
    config: {
      path: 'config/client',
      intro: 'Configure the credentials Vault uses to verify EC2 identities.',
      fields: [
        { key: 'access_key', label: 'Access key', type: 'text' },
        { key: 'secret_key', label: 'Secret key', type: 'password', writeOnly: true },
        { key: 'endpoint', label: 'Endpoint', type: 'text' },
        { key: 'iam_endpoint', label: 'IAM endpoint', type: 'text' },
        { key: 'sts_endpoint', label: 'STS endpoint', type: 'text' },
        { key: 'sts_region', label: 'STS region', type: 'text' },
      ],
    },
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          { key: 'bound_ami_id', label: 'Bound AMI ID', type: 'text' },
          { key: 'bound_account_id', label: 'Bound account ID', type: 'text' },
          { key: 'bound_region', label: 'Bound region', type: 'text' },
          { key: 'bound_vpc_id', label: 'Bound VPC ID', type: 'text' },
          { key: 'bound_subnet_id', label: 'Bound subnet ID', type: 'text' },
          { key: 'bound_iam_instance_profile_arn', label: 'Bound instance profile ARN', type: 'text' },
          { key: 'role_tag', label: 'Role tag', type: 'text' },
          ...roleTtlFields,
          policiesField,
        ],
      },
    ],
  },
  github: {
    type: 'github',
    label: 'GitHub',
    description: 'Authentication with GitHub teams and users.',
    config: {
      path: 'config',
      fields: [
        { key: 'organization', label: 'Organization', type: 'text', required: true },
        { key: 'base_url', label: 'GitHub base URL', type: 'text', placeholder: 'https://api.github.com/' },
        ...ttlFields,
      ],
    },
    collections: [
      {
        key: 'teams',
        label: 'Teams',
        path: 'map/teams',
        itemLabel: 'team',
        nameLabel: 'Team (org/team)',
        fields: [policiesField],
        policiesKey: 'value',
        policiesFormat: 'csv',
      },
      {
        key: 'users',
        label: 'Users',
        path: 'map/users',
        itemLabel: 'user',
        nameLabel: 'GitHub username',
        fields: [policiesField],
        policiesKey: 'value',
        policiesFormat: 'csv',
      },
    ],
  },
  kubernetes: {
    type: 'kubernetes',
    label: 'Kubernetes',
    description: 'Authentication for Kubernetes service accounts.',
    config: {
      path: 'config',
      intro: 'Configure how Vault validates Kubernetes service account tokens.',
      fields: [
        { key: 'kubernetes_host', label: 'Kubernetes host', type: 'text', required: true },
        { key: 'kubernetes_ca_cert', label: 'Kubernetes CA certificate', type: 'text' },
        { key: 'token_reviewer_jwt', label: 'Token reviewer JWT', type: 'password', writeOnly: true },
        { key: 'issuer', label: 'Issuer', type: 'text' },
        { key: 'disable_local_ca_jwt', label: 'Disable local CA JWT', type: 'boolean' },
      ],
    },
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          { key: 'bound_service_account_names', label: 'Service account names', type: 'csv' },
          { key: 'bound_service_account_namespaces', label: 'Service account namespaces', type: 'csv' },
          { key: 'audience', label: 'Audience', type: 'text' },
          ...roleTtlFields,
          policiesField,
        ],
      },
    ],
  },
  okta: {
    type: 'okta',
    label: 'Okta',
    description: 'Authentication with Okta users and groups.',
    config: {
      path: 'config',
      fields: [
        { key: 'org_name', label: 'Okta organization', type: 'text', required: true },
        { key: 'api_token', label: 'API token', type: 'password', writeOnly: true },
        { key: 'base_url', label: 'Base URL', type: 'text' },
        { key: 'bypass_okta_mfa', label: 'Bypass Okta MFA', type: 'boolean' },
        ...ttlFields,
      ],
    },
    collections: [
      {
        key: 'users',
        label: 'Users',
        path: 'users',
        itemLabel: 'user',
        nameLabel: 'Username',
        fields: [policiesField],
      },
      {
        key: 'groups',
        label: 'Groups',
        path: 'groups',
        itemLabel: 'group',
        nameLabel: 'Group name',
        fields: [policiesField],
      },
    ],
  },
  radius: {
    type: 'radius',
    label: 'RADIUS',
    description: 'Authentication against a RADIUS server.',
    config: {
      path: 'config',
      fields: [
        { key: 'host', label: 'RADIUS host', type: 'text', required: true },
        { key: 'port', label: 'Port', type: 'number', placeholder: '1812' },
        { key: 'secret', label: 'Shared secret', type: 'password', writeOnly: true },
        { key: 'dial_timeout', label: 'Dial timeout', type: 'text', placeholder: '10s' },
        { key: 'read_timeout', label: 'Read timeout', type: 'text', placeholder: '10s' },
        { key: 'nas_port', label: 'NAS port', type: 'number' },
        ...ttlFields,
      ],
    },
    collections: [
      {
        key: 'users',
        label: 'Users',
        path: 'users',
        itemLabel: 'user',
        nameLabel: 'Username',
        fields: [policiesField],
      },
    ],
  },
  userpass: {
    type: 'userpass',
    label: 'Username & Password',
    description: 'Built-in username and password authentication.',
    collections: [
      {
        key: 'users',
        label: 'Users',
        path: 'users',
        itemLabel: 'user',
        nameLabel: 'Username',
        fields: [
          { key: 'password', label: 'Password', type: 'password', writeOnly: true },
          { key: 'password_policy', label: 'Password policy', type: 'text' },
          { key: 'token_ttl', label: 'Token TTL', type: 'text' },
          { key: 'token_max_ttl', label: 'Token max TTL', type: 'text' },
          { key: 'token_bound_cidrs', label: 'Token bound CIDRs', type: 'csv' },
          policiesField,
        ],
      },
    ],
  },
  ldap: {
    type: 'ldap',
    label: 'LDAP',
    description: 'Authentication against an LDAP directory.',
    config: {
      path: 'config',
      fields: [
        { key: 'url', label: 'LDAP URL', type: 'text', placeholder: 'ldap://ldap.example.com' },
        { key: 'userdn', label: 'User DN', type: 'text' },
        { key: 'userattr', label: 'User attribute', type: 'text', placeholder: 'cn' },
        { key: 'groupdn', label: 'Group DN', type: 'text' },
        { key: 'groupattr', label: 'Group attribute', type: 'text', placeholder: 'cn' },
        { key: 'binddn', label: 'Bind DN', type: 'text' },
        { key: 'bindpass', label: 'Bind password', type: 'password', writeOnly: true },
        { key: 'upndomain', label: 'UPN domain', type: 'text' },
        { key: 'insecure_tls', label: 'Insecure TLS', type: 'boolean' },
        { key: 'starttls', label: 'StartTLS', type: 'boolean' },
        ...ttlFields,
      ],
    },
    collections: [
      {
        key: 'users',
        label: 'Users',
        path: 'users',
        itemLabel: 'user',
        nameLabel: 'Username',
        fields: [policiesField],
      },
      {
        key: 'groups',
        label: 'Groups',
        path: 'groups',
        itemLabel: 'group',
        nameLabel: 'Group name',
        fields: [policiesField],
      },
    ],
  },
  jwt: {
    type: 'jwt',
    label: 'JWT',
    description: 'Authentication with signed JSON Web Tokens.',
    config: {
      path: 'config',
      fields: [
        { key: 'jwks_url', label: 'JWKS URL', type: 'text' },
        { key: 'jwks_ca_pem', label: 'JWKS CA PEM', type: 'text' },
        { key: 'jwt_validation_pubkeys', label: 'Validation public keys', type: 'csv' },
        { key: 'bound_issuer', label: 'Bound issuer', type: 'text' },
        { key: 'oidc_discovery_url', label: 'OIDC discovery URL', type: 'text' },
      ],
    },
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          {
            key: 'role_type',
            label: 'Role type',
            type: 'select',
            options: [
              { value: 'jwt', label: 'JWT' },
              { value: 'oidc', label: 'OIDC' },
            ],
          },
          { key: 'bound_audiences', label: 'Bound audiences', type: 'csv' },
          { key: 'user_claim', label: 'User claim', type: 'text', placeholder: 'sub' },
          { key: 'groups_claim', label: 'Groups claim', type: 'text' },
          { key: 'bound_claims', label: 'Bound claims', type: 'json' },
          { key: 'claim_mappings', label: 'Claim mappings', type: 'json' },
          ...roleTtlFields,
          policiesField,
        ],
      },
    ],
  },
  oidc: {
    type: 'oidc',
    label: 'OIDC',
    description: 'OIDC / OAuth2 authentication.',
    config: {
      path: 'config',
      fields: [
        { key: 'oidc_discovery_url', label: 'OIDC discovery URL', type: 'text' },
        { key: 'oidc_client_id', label: 'Client ID', type: 'text' },
        { key: 'oidc_client_secret', label: 'Client secret', type: 'password', writeOnly: true },
        { key: 'oidc_response_mode', label: 'Response mode', type: 'text', placeholder: 'query' },
        { key: 'oidc_response_types', label: 'Response types', type: 'csv' },
        { key: 'bound_issuer', label: 'Bound issuer', type: 'text' },
        { key: 'default_role', label: 'Default role', type: 'text' },
      ],
    },
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          {
            key: 'role_type',
            label: 'Role type',
            type: 'select',
            options: [
              { value: 'oidc', label: 'OIDC' },
              { value: 'jwt', label: 'JWT' },
            ],
          },
          { key: 'bound_audiences', label: 'Bound audiences', type: 'csv' },
          { key: 'user_claim', label: 'User claim', type: 'text', placeholder: 'sub' },
          { key: 'groups_claim', label: 'Groups claim', type: 'text' },
          { key: 'allowed_redirect_uris', label: 'Allowed redirect URIs', type: 'csv' },
          { key: 'bound_claims', label: 'Bound claims', type: 'json' },
          ...roleTtlFields,
          policiesField,
        ],
      },
    ],
  },
  cert: {
    type: 'cert',
    label: 'TLS Certificates',
    description: 'Authenticate clients using TLS certificates.',
    config: {
      path: 'config',
      fields: [{ key: 'disable_binding', label: 'Disable binding', type: 'boolean' }],
    },
    collections: [
      {
        key: 'certs',
        label: 'Certificates',
        path: 'certs',
        itemLabel: 'certificate',
        nameLabel: 'Certificate name',
        fields: [
          { key: 'certificate', label: 'PEM certificate', type: 'text', required: true },
          { key: 'display_name', label: 'Display name', type: 'text' },
          policiesField,
        ],
      },
    ],
  },
  gcp: {
    type: 'gcp',
    label: 'GCP',
    description: 'Authentication for Google Cloud identities.',
    config: {
      path: 'config',
      fields: [{ key: 'credentials', label: 'Service account credentials (JSON)', type: 'json' }],
    },
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          {
            key: 'type',
            label: 'Role type',
            type: 'select',
            options: [
              { value: 'iam', label: 'IAM' },
              { value: 'gce', label: 'GCE' },
            ],
          },
          { key: 'bound_service_accounts', label: 'Bound service accounts', type: 'csv' },
          { key: 'bound_projects', label: 'Bound projects', type: 'csv' },
          ...roleTtlFields,
          policiesField,
        ],
      },
    ],
  },
  azure: {
    type: 'azure',
    label: 'Azure',
    description: 'Authentication for Azure managed identities and service principals.',
    config: {
      path: 'config',
      fields: [
        { key: 'tenant_id', label: 'Tenant ID', type: 'text' },
        { key: 'client_id', label: 'Client ID', type: 'text' },
        { key: 'client_secret', label: 'Client secret', type: 'password', writeOnly: true },
        { key: 'environment', label: 'Environment', type: 'text', placeholder: 'AzurePublicCloud' },
      ],
    },
    collections: [
      {
        key: 'roles',
        label: 'Roles',
        path: 'role',
        itemLabel: 'role',
        nameLabel: 'Role name',
        fields: [
          { key: 'bound_service_principal_ids', label: 'Bound service principal IDs', type: 'csv' },
          { key: 'bound_group_ids', label: 'Bound group IDs', type: 'csv' },
          { key: 'bound_subscription_ids', label: 'Bound subscription IDs', type: 'csv' },
          ...roleTtlFields,
          policiesField,
        ],
      },
    ],
  },
};

export const AUTH_BACKEND_TYPES = Object.keys(AUTH_BACKENDS);

export function getAuthBackend(type: string): AuthBackendDef | undefined {
  return AUTH_BACKENDS[type];
}
