import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as tls from 'node:tls';
import * as v from 'valibot';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const INTEGER_PATTERN = /^-?\d+$/;

function isUnset(raw: string | undefined): boolean {
  return raw === undefined || raw.trim() === '';
}

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return defaultValue;

  const normalized = trimmed.toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  throw new Error(`Invalid boolean value "${raw}".`);
}

function parseIntEnv(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return undefined;

  if (!INTEGER_PATTERN.test(trimmed)) {
    throw new Error(`Invalid integer value "${raw}".`);
  }

  return Number.parseInt(trimmed, 10);
}

function parseEncrypt(raw: string | undefined): boolean | 'strict' {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return true;

  const t = trimmed.toLowerCase();
  if (t === 'strict') return 'strict';
  return parseBool(raw, true);
}

function normalizeAuthType(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return undefined;

  const t = trimmed.toLowerCase();
  if (t === '' || t === 'default') return undefined;
  return t;
}

const TDS_VERSIONS = new Set(['7_1', '7_2', '7_3_A', '7_3_B', '7_4']);

const ALLOWED_AUTH: ReadonlySet<string> = new Set([
  'ntlm',
  'azure-active-directory-password',
  'azure-active-directory-access-token',
  'azure-active-directory-service-principal-secret',
]);

function readPemFileOptional(
  label: string,
  filePath: string | undefined,
): Buffer | undefined {
  const trimmed = filePath?.trim();
  if (trimmed === undefined || trimmed === '') return undefined;

  const resolved = path.resolve(trimmed);
  try {
    return fs.readFileSync(resolved);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${label} file at ${resolved}: ${msg}`);
  }
}

const envSchema = v.object({
  MSSQL_SERVER: v.pipe(v.string(), v.nonEmpty()),
  MSSQL_USER: v.optional(v.string()),
  MSSQL_PASSWORD: v.optional(v.string()),
  MSSQL_DATABASE: v.pipe(v.string(), v.nonEmpty()),
  MSSQL_PORT: v.optional(v.string()),
  MSSQL_ENCRYPT: v.optional(v.string()),
  MSSQL_TRUST_SERVER_CERTIFICATE: v.optional(v.string()),
  MSSQL_ALLOW_WRITES: v.optional(v.string()),
  MSSQL_QUERY_TIMEOUT_MS: v.optional(v.string()),
  MSSQL_TLS_SERVER_NAME: v.optional(v.string()),
  MSSQL_TLS_CA_FILE: v.optional(v.string()),
  MSSQL_TLS_CERT_FILE: v.optional(v.string()),
  MSSQL_TLS_KEY_FILE: v.optional(v.string()),
  MSSQL_TLS_KEY_PASSPHRASE: v.optional(v.string()),
  MSSQL_CONNECTION_TIMEOUT_MS: v.optional(v.string()),
  MSSQL_DOMAIN: v.optional(v.string()),
  MSSQL_INSTANCE_NAME: v.optional(v.string()),
  MSSQL_MULTI_SUBNET_FAILOVER: v.optional(v.string()),
  MSSQL_READ_ONLY_INTENT: v.optional(v.string()),
  MSSQL_MAX_RETRIES_ON_TRANSIENT_ERRORS: v.optional(v.string()),
  MSSQL_CONNECTION_RETRY_INTERVAL_MS: v.optional(v.string()),
  MSSQL_POOL_MAX: v.optional(v.string()),
  MSSQL_POOL_MIN: v.optional(v.string()),
  MSSQL_POOL_IDLE_TIMEOUT_MS: v.optional(v.string()),
  MSSQL_APP_NAME: v.optional(v.string()),
  MSSQL_USE_UTC: v.optional(v.string()),
  MSSQL_TDS_VERSION: v.optional(v.string()),
  MSSQL_AUTH_TYPE: v.optional(v.string()),
  MSSQL_AZURE_CLIENT_ID: v.optional(v.string()),
  MSSQL_AZURE_TENANT_ID: v.optional(v.string()),
  MSSQL_AZURE_CLIENT_SECRET: v.optional(v.string()),
  MSSQL_AZURE_ACCESS_TOKEN: v.optional(v.string()),
});

type EnvOut = v.InferOutput<typeof envSchema>;

export type AuthTypeNormalized =
  | undefined
  | 'ntlm'
  | 'azure-active-directory-password'
  | 'azure-active-directory-access-token'
  | 'azure-active-directory-service-principal-secret';

export type AppConfig = {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
  encrypt: boolean | 'strict';
  trustServerCertificate: boolean;
  allowWrites: boolean;
  queryTimeoutMs: number | undefined;
  authType: AuthTypeNormalized;
  domain: string | undefined;
  tlsServerName: string | undefined;
  cryptoCredentialsDetails: tls.SecureContextOptions | undefined;
  connectionTimeoutMs: number | undefined;
  instanceName: string | undefined;
  multiSubnetFailover: boolean | undefined;
  readOnlyIntent: boolean | undefined;
  maxRetriesOnTransientErrors: number | undefined;
  connectionRetryIntervalMs: number | undefined;
  poolMax: number;
  poolMin: number;
  poolIdleTimeoutMs: number;
  appName: string | undefined;
  useUtc: boolean | undefined;
  tdsVersion: string | undefined;
  azureClientId: string | undefined;
  azureTenantId: string | undefined;
  azureClientSecret: string | undefined;
  azureAccessToken: string | undefined;
};

function inferAuthType(e: EnvOut): AuthTypeNormalized {
  const t = normalizeAuthType(e.MSSQL_AUTH_TYPE);
  if (t === undefined) return undefined;
  return t as AuthTypeNormalized;
}

const BOOLEAN_ENV_KEYS = [
  'MSSQL_TRUST_SERVER_CERTIFICATE',
  'MSSQL_ALLOW_WRITES',
  'MSSQL_MULTI_SUBNET_FAILOVER',
  'MSSQL_READ_ONLY_INTENT',
  'MSSQL_USE_UTC',
] as const;

type IntegerEnvRule = {
  key: keyof EnvOut;
  min: number;
  max?: number;
};

const INTEGER_ENV_RULES: ReadonlyArray<IntegerEnvRule> = [
  { key: 'MSSQL_PORT', min: 1, max: 65_535 },
  { key: 'MSSQL_QUERY_TIMEOUT_MS', min: 0 },
  { key: 'MSSQL_CONNECTION_TIMEOUT_MS', min: 0 },
  { key: 'MSSQL_MAX_RETRIES_ON_TRANSIENT_ERRORS', min: 0 },
  { key: 'MSSQL_CONNECTION_RETRY_INTERVAL_MS', min: 0 },
  { key: 'MSSQL_POOL_MAX', min: 1 },
  { key: 'MSSQL_POOL_MIN', min: 0 },
  { key: 'MSSQL_POOL_IDLE_TIMEOUT_MS', min: 0 },
];

function rawScalarChecks(
  e: EnvOut,
  addIssue: (info?: { message?: string }) => void,
): void {
  if (e.MSSQL_SERVER.trim() === '') {
    addIssue({ message: 'MSSQL_SERVER is required and cannot be blank.' });
  }

  if (e.MSSQL_DATABASE.trim() === '') {
    addIssue({ message: 'MSSQL_DATABASE is required and cannot be blank.' });
  }

  for (const key of BOOLEAN_ENV_KEYS) {
    const raw = e[key];
    if (isUnset(raw)) continue;

    const normalized = raw!.trim().toLowerCase();
    if (!TRUE_VALUES.has(normalized) && !FALSE_VALUES.has(normalized)) {
      addIssue({
        message: `${key} must be one of: 1, true, yes, on, 0, false, no, off.`,
      });
    }
  }

  const encryptRaw = e.MSSQL_ENCRYPT;
  if (!isUnset(encryptRaw)) {
    const normalized = encryptRaw!.trim().toLowerCase();
    if (
      normalized !== 'strict' &&
      !TRUE_VALUES.has(normalized) &&
      !FALSE_VALUES.has(normalized)
    ) {
      addIssue({
        message:
          'MSSQL_ENCRYPT must be one of: 1, true, yes, on, 0, false, no, off, strict.',
      });
    }
  }

  for (const rule of INTEGER_ENV_RULES) {
    const raw = e[rule.key];
    if (typeof raw !== 'string' || isUnset(raw)) continue;

    const trimmed = raw.trim();
    if (!INTEGER_PATTERN.test(trimmed)) {
      addIssue({ message: `${rule.key} must be an integer.` });
      continue;
    }

    const value = Number.parseInt(trimmed, 10);
    if (value < rule.min || (rule.max !== undefined && value > rule.max)) {
      const range =
        rule.max === undefined
          ? `greater than or equal to ${rule.min}`
          : `between ${rule.min} and ${rule.max}`;
      addIssue({ message: `${rule.key} must be ${range}.` });
    }
  }
}

function rawEnvChecks(
  e: EnvOut,
  addIssue: (info?: { message?: string }) => void,
): void {
  const rawAuth = normalizeAuthType(e.MSSQL_AUTH_TYPE);
  if (rawAuth !== undefined && !ALLOWED_AUTH.has(rawAuth)) {
    addIssue({
      message: `Unsupported MSSQL_AUTH_TYPE "${e.MSSQL_AUTH_TYPE?.trim()}". Use default (unset), ntlm, azure-active-directory-password, azure-active-directory-access-token, or azure-active-directory-service-principal-secret.`,
    });
    return;
  }

  const authType = inferAuthType(e);
  const user = (e.MSSQL_USER ?? '').trim();

  if (authType === undefined) {
    if (user === '') {
      addIssue({
        message:
          'MSSQL_USER is required for SQL authentication (or set MSSQL_AUTH_TYPE).',
      });
    }
    if (e.MSSQL_PASSWORD === undefined) {
      addIssue({
        message: 'MSSQL_PASSWORD is required for SQL authentication.',
      });
    }
    return;
  }

  if (authType === 'ntlm') {
    if (user === '')
      addIssue({
        message: 'MSSQL_USER is required when MSSQL_AUTH_TYPE=ntlm.',
      });
    if (e.MSSQL_PASSWORD === undefined) {
      addIssue({
        message: 'MSSQL_PASSWORD is required when MSSQL_AUTH_TYPE=ntlm.',
      });
    }
    if (!e.MSSQL_DOMAIN?.trim())
      addIssue({
        message: 'MSSQL_DOMAIN is required when MSSQL_AUTH_TYPE=ntlm.',
      });
    return;
  }

  if (authType === 'azure-active-directory-password') {
    if (user === '') {
      addIssue({
        message:
          'MSSQL_USER is required when MSSQL_AUTH_TYPE=azure-active-directory-password.',
      });
    }
    if (e.MSSQL_PASSWORD === undefined) {
      addIssue({
        message:
          'MSSQL_PASSWORD is required when MSSQL_AUTH_TYPE=azure-active-directory-password.',
      });
    }
    if (!e.MSSQL_AZURE_CLIENT_ID?.trim()) {
      addIssue({
        message:
          'MSSQL_AZURE_CLIENT_ID is required when MSSQL_AUTH_TYPE=azure-active-directory-password.',
      });
    }
    return;
  }

  if (authType === 'azure-active-directory-access-token') {
    if (!e.MSSQL_AZURE_ACCESS_TOKEN?.trim()) {
      addIssue({
        message:
          'MSSQL_AZURE_ACCESS_TOKEN is required when MSSQL_AUTH_TYPE=azure-active-directory-access-token.',
      });
    }
    return;
  }

  if (authType === 'azure-active-directory-service-principal-secret') {
    if (!e.MSSQL_AZURE_CLIENT_ID?.trim()) {
      addIssue({
        message:
          'MSSQL_AZURE_CLIENT_ID is required when MSSQL_AUTH_TYPE=azure-active-directory-service-principal-secret.',
      });
    }
    if (!e.MSSQL_AZURE_CLIENT_SECRET?.trim()) {
      addIssue({
        message:
          'MSSQL_AZURE_CLIENT_SECRET is required when MSSQL_AUTH_TYPE=azure-active-directory-service-principal-secret.',
      });
    }
    if (!e.MSSQL_AZURE_TENANT_ID?.trim()) {
      addIssue({
        message:
          'MSSQL_AZURE_TENANT_ID is required when MSSQL_AUTH_TYPE=azure-active-directory-service-principal-secret.',
      });
    }
  }
}

function rawPoolChecks(
  e: EnvOut,
  addIssue: (info?: { message?: string }) => void,
): void {
  const poolMaxRaw = e.MSSQL_POOL_MAX?.trim();
  const poolMinRaw = e.MSSQL_POOL_MIN?.trim();

  if (
    (poolMaxRaw !== undefined &&
      poolMaxRaw !== '' &&
      !INTEGER_PATTERN.test(poolMaxRaw)) ||
    (poolMinRaw !== undefined &&
      poolMinRaw !== '' &&
      !INTEGER_PATTERN.test(poolMinRaw))
  ) {
    return;
  }

  const poolMax = parseIntEnv(e.MSSQL_POOL_MAX) ?? 10;
  const poolMin = parseIntEnv(e.MSSQL_POOL_MIN) ?? 0;
  if (poolMin > poolMax) {
    addIssue({
      message: `MSSQL_POOL_MIN (${poolMin}) cannot be greater than MSSQL_POOL_MAX (${poolMax}).`,
    });
  }
}

function rawTdsChecks(
  e: EnvOut,
  addIssue: (info?: { message?: string }) => void,
): void {
  const tdsRaw = e.MSSQL_TDS_VERSION?.trim();
  if (tdsRaw === undefined || tdsRaw === '') return;
  if (!TDS_VERSIONS.has(tdsRaw)) {
    addIssue({
      message: `Invalid MSSQL_TDS_VERSION "${tdsRaw}". Use one of: ${[...TDS_VERSIONS].join(', ')}.`,
    });
  }
}

const appConfigSchema = v.pipe(
  envSchema,
  v.rawCheck(({ dataset, addIssue }) => {
    rawScalarChecks(dataset.value as EnvOut, addIssue);
  }),
  v.rawCheck(({ dataset, addIssue }) => {
    rawEnvChecks(dataset.value as EnvOut, addIssue);
  }),
  v.rawCheck(({ dataset, addIssue }) => {
    rawPoolChecks(dataset.value as EnvOut, addIssue);
  }),
  v.rawCheck(({ dataset, addIssue }) => {
    rawTdsChecks(dataset.value as EnvOut, addIssue);
  }),
  v.transform((e): AppConfig => {
    const authType = inferAuthType(e);

    const port = parseIntEnv(e.MSSQL_PORT) ?? 1433;

    const queryTimeoutValue = parseIntEnv(e.MSSQL_QUERY_TIMEOUT_MS);
    const queryTimeoutMs =
      queryTimeoutValue === undefined || queryTimeoutValue === 0
        ? undefined
        : queryTimeoutValue;

    const connectionTimeoutValue = parseIntEnv(e.MSSQL_CONNECTION_TIMEOUT_MS);
    const connectionTimeoutMs =
      connectionTimeoutValue === undefined || connectionTimeoutValue === 0
        ? undefined
        : connectionTimeoutValue;

    const ca = readPemFileOptional('MSSQL_TLS_CA_FILE', e.MSSQL_TLS_CA_FILE);
    const cert = readPemFileOptional(
      'MSSQL_TLS_CERT_FILE',
      e.MSSQL_TLS_CERT_FILE,
    );
    const key = readPemFileOptional('MSSQL_TLS_KEY_FILE', e.MSSQL_TLS_KEY_FILE);
    const passphrase = e.MSSQL_TLS_KEY_PASSPHRASE?.trim() || undefined;

    let cryptoCredentialsDetails: tls.SecureContextOptions | undefined;
    if (
      ca !== undefined ||
      cert !== undefined ||
      key !== undefined ||
      passphrase !== undefined
    ) {
      cryptoCredentialsDetails = {};
      if (ca !== undefined) cryptoCredentialsDetails.ca = ca;
      if (cert !== undefined) cryptoCredentialsDetails.cert = cert;
      if (key !== undefined) cryptoCredentialsDetails.key = key;
      if (passphrase !== undefined)
        cryptoCredentialsDetails.passphrase = passphrase;
    }

    const retriesValue = parseIntEnv(e.MSSQL_MAX_RETRIES_ON_TRANSIENT_ERRORS);
    const maxRetriesOnTransientErrors =
      retriesValue === undefined || retriesValue === 0
        ? undefined
        : retriesValue;

    const retryIntervalValue = parseIntEnv(
      e.MSSQL_CONNECTION_RETRY_INTERVAL_MS,
    );
    const connectionRetryIntervalMs =
      retryIntervalValue === undefined || retryIntervalValue === 0
        ? undefined
        : retryIntervalValue;

    const tdsRaw = e.MSSQL_TDS_VERSION?.trim();
    const tdsVersion =
      tdsRaw === '' || tdsRaw === undefined ? undefined : tdsRaw;

    const instanceTrim = e.MSSQL_INSTANCE_NAME?.trim();
    const instanceName = instanceTrim === '' ? undefined : instanceTrim;

    const multiRaw = e.MSSQL_MULTI_SUBNET_FAILOVER;
    const multiSubnetFailover = isUnset(multiRaw)
      ? undefined
      : parseBool(multiRaw, false);

    const readOnlyRaw = e.MSSQL_READ_ONLY_INTENT;
    const readOnlyIntent = isUnset(readOnlyRaw)
      ? undefined
      : parseBool(readOnlyRaw, false);

    const useUtcRaw = e.MSSQL_USE_UTC;
    const useUtc = isUnset(useUtcRaw) ? undefined : parseBool(useUtcRaw, true);

    const poolMax = parseIntEnv(e.MSSQL_POOL_MAX) ?? 10;
    const poolMin = parseIntEnv(e.MSSQL_POOL_MIN) ?? 0;
    const poolIdleTimeoutMs =
      parseIntEnv(e.MSSQL_POOL_IDLE_TIMEOUT_MS) ?? 30_000;

    const appTrim = e.MSSQL_APP_NAME?.trim();
    const appName = appTrim === '' ? undefined : appTrim;

    const tlsServerTrim = e.MSSQL_TLS_SERVER_NAME?.trim();

    return {
      server: e.MSSQL_SERVER.trim(),
      port,
      user: (e.MSSQL_USER ?? '').trim(),
      password: e.MSSQL_PASSWORD ?? '',
      database: e.MSSQL_DATABASE.trim(),
      encrypt: parseEncrypt(e.MSSQL_ENCRYPT),
      trustServerCertificate: parseBool(
        e.MSSQL_TRUST_SERVER_CERTIFICATE,
        false,
      ),
      allowWrites: parseBool(e.MSSQL_ALLOW_WRITES, false),
      queryTimeoutMs,
      authType,
      domain: e.MSSQL_DOMAIN?.trim() || undefined,
      tlsServerName: tlsServerTrim === '' ? undefined : tlsServerTrim,
      cryptoCredentialsDetails,
      connectionTimeoutMs,
      instanceName,
      multiSubnetFailover,
      readOnlyIntent,
      maxRetriesOnTransientErrors,
      connectionRetryIntervalMs,
      poolMax,
      poolMin,
      poolIdleTimeoutMs,
      appName,
      useUtc,
      tdsVersion,
      azureClientId: e.MSSQL_AZURE_CLIENT_ID?.trim() || undefined,
      azureTenantId: e.MSSQL_AZURE_TENANT_ID?.trim() || undefined,
      azureClientSecret: e.MSSQL_AZURE_CLIENT_SECRET ?? undefined,
      azureAccessToken: e.MSSQL_AZURE_ACCESS_TOKEN?.trim() || undefined,
    };
  }),
);

function readProcessEnv() {
  return {
    MSSQL_SERVER: process.env.MSSQL_SERVER,
    MSSQL_USER: process.env.MSSQL_USER,
    MSSQL_PASSWORD: process.env.MSSQL_PASSWORD,
    MSSQL_DATABASE: process.env.MSSQL_DATABASE,
    MSSQL_PORT: process.env.MSSQL_PORT,
    MSSQL_ENCRYPT: process.env.MSSQL_ENCRYPT,
    MSSQL_TRUST_SERVER_CERTIFICATE: process.env.MSSQL_TRUST_SERVER_CERTIFICATE,
    MSSQL_ALLOW_WRITES: process.env.MSSQL_ALLOW_WRITES,
    MSSQL_QUERY_TIMEOUT_MS: process.env.MSSQL_QUERY_TIMEOUT_MS,
    MSSQL_TLS_SERVER_NAME: process.env.MSSQL_TLS_SERVER_NAME,
    MSSQL_TLS_CA_FILE: process.env.MSSQL_TLS_CA_FILE,
    MSSQL_TLS_CERT_FILE: process.env.MSSQL_TLS_CERT_FILE,
    MSSQL_TLS_KEY_FILE: process.env.MSSQL_TLS_KEY_FILE,
    MSSQL_TLS_KEY_PASSPHRASE: process.env.MSSQL_TLS_KEY_PASSPHRASE,
    MSSQL_CONNECTION_TIMEOUT_MS: process.env.MSSQL_CONNECTION_TIMEOUT_MS,
    MSSQL_DOMAIN: process.env.MSSQL_DOMAIN,
    MSSQL_INSTANCE_NAME: process.env.MSSQL_INSTANCE_NAME,
    MSSQL_MULTI_SUBNET_FAILOVER: process.env.MSSQL_MULTI_SUBNET_FAILOVER,
    MSSQL_READ_ONLY_INTENT: process.env.MSSQL_READ_ONLY_INTENT,
    MSSQL_MAX_RETRIES_ON_TRANSIENT_ERRORS:
      process.env.MSSQL_MAX_RETRIES_ON_TRANSIENT_ERRORS,
    MSSQL_CONNECTION_RETRY_INTERVAL_MS:
      process.env.MSSQL_CONNECTION_RETRY_INTERVAL_MS,
    MSSQL_POOL_MAX: process.env.MSSQL_POOL_MAX,
    MSSQL_POOL_MIN: process.env.MSSQL_POOL_MIN,
    MSSQL_POOL_IDLE_TIMEOUT_MS: process.env.MSSQL_POOL_IDLE_TIMEOUT_MS,
    MSSQL_APP_NAME: process.env.MSSQL_APP_NAME,
    MSSQL_USE_UTC: process.env.MSSQL_USE_UTC,
    MSSQL_TDS_VERSION: process.env.MSSQL_TDS_VERSION,
    MSSQL_AUTH_TYPE: process.env.MSSQL_AUTH_TYPE,
    MSSQL_AZURE_CLIENT_ID: process.env.MSSQL_AZURE_CLIENT_ID,
    MSSQL_AZURE_TENANT_ID: process.env.MSSQL_AZURE_TENANT_ID,
    MSSQL_AZURE_CLIENT_SECRET: process.env.MSSQL_AZURE_CLIENT_SECRET,
    MSSQL_AZURE_ACCESS_TOKEN: process.env.MSSQL_AZURE_ACCESS_TOKEN,
  };
}

export function loadConfig(): AppConfig {
  return v.parse(
    appConfigSchema,
    readProcessEnv() as v.InferInput<typeof envSchema>,
  );
}

export function mssqlDriverConfig(cfg: AppConfig): import('mssql').config {
  const options: NonNullable<import('mssql').config['options']> = {
    encrypt: cfg.encrypt,
    trustServerCertificate: cfg.trustServerCertificate,
  };

  if (cfg.tlsServerName !== undefined) options.serverName = cfg.tlsServerName;
  if (cfg.instanceName !== undefined) options.instanceName = cfg.instanceName;
  if (cfg.multiSubnetFailover !== undefined)
    options.multiSubnetFailover = cfg.multiSubnetFailover;
  if (cfg.readOnlyIntent !== undefined)
    options.readOnlyIntent = cfg.readOnlyIntent;
  if (cfg.maxRetriesOnTransientErrors !== undefined) {
    options.maxRetriesOnTransientErrors = cfg.maxRetriesOnTransientErrors;
  }
  if (cfg.connectionRetryIntervalMs !== undefined) {
    options.connectionRetryInterval = cfg.connectionRetryIntervalMs;
  }
  if (cfg.cryptoCredentialsDetails !== undefined) {
    options.cryptoCredentialsDetails = cfg.cryptoCredentialsDetails;
  }
  if (cfg.appName !== undefined) options.appName = cfg.appName;
  if (cfg.useUtc !== undefined) options.useUTC = cfg.useUtc;
  if (cfg.tdsVersion !== undefined) {
    options.tdsVersion = cfg.tdsVersion as NonNullable<
      NonNullable<import('mssql').config['options']>['tdsVersion']
    >;
  }

  let authentication: import('mssql').config['authentication'] | undefined;
  if (cfg.authType === 'ntlm') {
    authentication = {
      type: 'ntlm',
      options: {
        userName: cfg.user,
        password: cfg.password,
        domain: cfg.domain!,
      },
    };
  } else if (cfg.authType === 'azure-active-directory-password') {
    authentication = {
      type: 'azure-active-directory-password',
      options: {
        userName: cfg.user,
        password: cfg.password,
        clientId: cfg.azureClientId!,
        tenantId: cfg.azureTenantId ?? 'common',
      },
    };
  } else if (cfg.authType === 'azure-active-directory-access-token') {
    authentication = {
      type: 'azure-active-directory-access-token',
      options: { token: cfg.azureAccessToken! },
    };
  } else if (
    cfg.authType === 'azure-active-directory-service-principal-secret'
  ) {
    authentication = {
      type: 'azure-active-directory-service-principal-secret',
      options: {
        clientId: cfg.azureClientId!,
        clientSecret: cfg.azureClientSecret!,
        tenantId: cfg.azureTenantId!,
      },
    };
  }

  const base: import('mssql').config = {
    server: cfg.server,
    database: cfg.database,
    pool: {
      max: cfg.poolMax,
      min: cfg.poolMin,
      idleTimeoutMillis: cfg.poolIdleTimeoutMs,
    },
    options,
    requestTimeout: cfg.queryTimeoutMs,
  };

  if (cfg.connectionTimeoutMs !== undefined) {
    base.connectionTimeout = cfg.connectionTimeoutMs;
  }

  if (cfg.instanceName === undefined) {
    base.port = cfg.port;
  }

  if (authentication !== undefined) {
    base.authentication = authentication;
  } else {
    base.user = cfg.user;
    base.password = cfg.password;
    if (cfg.domain !== undefined) {
      base.domain = cfg.domain;
    }
  }

  return base;
}
