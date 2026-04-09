import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig } from '../src/config.js';

const MSSQL_ENV_KEYS = [
  'MSSQL_SERVER',
  'MSSQL_USER',
  'MSSQL_PASSWORD',
  'MSSQL_DATABASE',
  'MSSQL_PORT',
  'MSSQL_ENCRYPT',
  'MSSQL_TRUST_SERVER_CERTIFICATE',
  'MSSQL_ALLOW_WRITES',
  'MSSQL_QUERY_TIMEOUT_MS',
  'MSSQL_TLS_SERVER_NAME',
  'MSSQL_TLS_CA_FILE',
  'MSSQL_TLS_CERT_FILE',
  'MSSQL_TLS_KEY_FILE',
  'MSSQL_TLS_KEY_PASSPHRASE',
  'MSSQL_CONNECTION_TIMEOUT_MS',
  'MSSQL_DOMAIN',
  'MSSQL_INSTANCE_NAME',
  'MSSQL_MULTI_SUBNET_FAILOVER',
  'MSSQL_READ_ONLY_INTENT',
  'MSSQL_MAX_RETRIES_ON_TRANSIENT_ERRORS',
  'MSSQL_CONNECTION_RETRY_INTERVAL_MS',
  'MSSQL_POOL_MAX',
  'MSSQL_POOL_MIN',
  'MSSQL_POOL_IDLE_TIMEOUT_MS',
  'MSSQL_APP_NAME',
  'MSSQL_USE_UTC',
  'MSSQL_TDS_VERSION',
  'MSSQL_AUTH_TYPE',
  'MSSQL_AZURE_CLIENT_ID',
  'MSSQL_AZURE_TENANT_ID',
  'MSSQL_AZURE_CLIENT_SECRET',
  'MSSQL_AZURE_ACCESS_TOKEN',
] as const;

type EnvOverrides = Partial<
  Record<(typeof MSSQL_ENV_KEYS)[number], string | undefined>
>;

const BASE_ENV: EnvOverrides = {
  MSSQL_SERVER: 'localhost',
  MSSQL_USER: 'reader',
  MSSQL_PASSWORD: 'secret',
  MSSQL_DATABASE: 'master',
};

function withEnv<T>(overrides: EnvOverrides, run: () => T): T {
  const snapshot = new Map<
    (typeof MSSQL_ENV_KEYS)[number],
    string | undefined
  >();

  for (const key of MSSQL_ENV_KEYS) {
    snapshot.set(key, process.env[key]);
    delete process.env[key];
  }

  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }

  try {
    return run();
  } finally {
    for (const key of MSSQL_ENV_KEYS) {
      const value = snapshot.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('loadConfig trims required strings and parses boolean/env flags explicitly', () => {
  const cfg = withEnv(
    {
      MSSQL_SERVER: ' localhost ',
      MSSQL_DATABASE: ' master ',
      MSSQL_ENCRYPT: 'strict',
      MSSQL_ALLOW_WRITES: 'yes',
      MSSQL_USE_UTC: 'off',
    },
    () => loadConfig(),
  );

  assert.equal(cfg.server, 'localhost');
  assert.equal(cfg.database, 'master');
  assert.equal(cfg.encrypt, 'strict');
  assert.equal(cfg.allowWrites, true);
  assert.equal(cfg.useUtc, false);
});

test('loadConfig rejects blank required values', () => {
  assert.throws(
    () =>
      withEnv(
        {
          MSSQL_SERVER: '   ',
        },
        () => loadConfig(),
      ),
    /MSSQL_SERVER is required and cannot be blank/,
  );

  assert.throws(
    () =>
      withEnv(
        {
          MSSQL_DATABASE: '   ',
        },
        () => loadConfig(),
      ),
    /MSSQL_DATABASE is required and cannot be blank/,
  );
});

test('loadConfig rejects invalid boolean and integer env values', () => {
  assert.throws(
    () =>
      withEnv(
        {
          MSSQL_ENCRYPT: 'maybe',
        },
        () => loadConfig(),
      ),
    /MSSQL_ENCRYPT must be one of/,
  );

  assert.throws(
    () =>
      withEnv(
        {
          MSSQL_POOL_MAX: 'many',
        },
        () => loadConfig(),
      ),
    /MSSQL_POOL_MAX must be an integer/,
  );
});

test('loadConfig requires passwords for password-based auth modes', () => {
  assert.throws(
    () =>
      withEnv(
        {
          MSSQL_PASSWORD: undefined,
        },
        () => loadConfig(),
      ),
    /MSSQL_PASSWORD is required for SQL authentication/,
  );

  assert.throws(
    () =>
      withEnv(
        {
          MSSQL_AUTH_TYPE: 'ntlm',
          MSSQL_PASSWORD: undefined,
          MSSQL_DOMAIN: 'corp',
        },
        () => loadConfig(),
      ),
    /MSSQL_PASSWORD is required when MSSQL_AUTH_TYPE=ntlm/,
  );

  assert.throws(
    () =>
      withEnv(
        {
          MSSQL_AUTH_TYPE: 'azure-active-directory-password',
          MSSQL_PASSWORD: undefined,
          MSSQL_AZURE_CLIENT_ID: 'client-id',
        },
        () => loadConfig(),
      ),
    /MSSQL_PASSWORD is required when MSSQL_AUTH_TYPE=azure-active-directory-password/,
  );
});
