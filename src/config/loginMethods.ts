import type { LoginMethodType } from '../api/auth';

export type LoginField =
  'token' | 'username' | 'password' | 'roleId' | 'secretId' | 'role' | 'jwt' | 'awsValue';

export interface LoginMethodDef {
  id: LoginMethodType;
  label: string;
  defaultPath: string;
  description: string;
  fields: LoginField[];
  awsLoginType?: 'iam' | 'ec2';
  oidc?: boolean;
}

export const LOGIN_METHODS: LoginMethodDef[] = [
  {
    id: 'TOKEN',
    label: 'Token',
    defaultPath: 'token',
    description: 'Use an existing Vault token.',
    fields: ['token'],
  },
  {
    id: 'USERPASSWORD',
    label: 'Username & Password',
    defaultPath: 'userpass',
    description: 'Authenticate against a userpass backend.',
    fields: ['username', 'password'],
  },
  {
    id: 'LDAP',
    label: 'LDAP',
    defaultPath: 'ldap',
    description: 'Authenticate against an LDAP backend.',
    fields: ['username', 'password'],
  },
  {
    id: 'OKTA',
    label: 'Okta',
    defaultPath: 'okta',
    description: 'Authenticate against an Okta backend.',
    fields: ['username', 'password'],
  },
  {
    id: 'GITHUB',
    label: 'GitHub',
    defaultPath: 'github',
    description: 'Authenticate with a GitHub personal access token.',
    fields: ['token'],
  },
  {
    id: 'APPROLE',
    label: 'AppRole',
    defaultPath: 'approle',
    description: 'Authenticate with a Role ID and Secret ID.',
    fields: ['roleId', 'secretId'],
  },
  {
    id: 'JWT',
    label: 'JWT',
    defaultPath: 'jwt',
    description: 'Authenticate with a signed JWT.',
    fields: ['role', 'jwt'],
  },
  {
    id: 'OIDC',
    label: 'OIDC / SSO',
    defaultPath: 'oidc',
    description: 'Log in through your identity provider in the browser.',
    fields: ['role'],
    oidc: true,
  },
  {
    id: 'AWS',
    label: 'AWS',
    defaultPath: 'aws',
    description: 'Authenticate with AWS IAM or EC2 credentials.',
    fields: ['role', 'awsValue'],
    awsLoginType: 'iam',
  },
  {
    id: 'KUBERNETES',
    label: 'Kubernetes',
    defaultPath: 'kubernetes',
    description: 'Authenticate with a Kubernetes service account JWT.',
    fields: ['role', 'jwt'],
  },
];

export function getLoginMethod(id: LoginMethodType | string): LoginMethodDef | undefined {
  const normalized = String(id).toUpperCase();
  return LOGIN_METHODS.find((method) => method.id === normalized);
}
