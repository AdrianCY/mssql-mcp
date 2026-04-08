import * as v from 'valibot';

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(raw);
}

function parseIntEnv(raw: string | undefined, defaultValue: number): number {
  if (raw === undefined || raw === '') return defaultValue;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

const envSchema = v.object({
  MSSQL_SERVER: v.pipe(v.string(), v.nonEmpty()),
  MSSQL_USER: v.pipe(v.string(), v.nonEmpty()),
  MSSQL_PASSWORD: v.string(),
  MSSQL_DATABASE: v.pipe(v.string(), v.nonEmpty()),
  MSSQL_PORT: v.optional(v.string()),
  MSSQL_ENCRYPT: v.optional(v.string()),
  MSSQL_TRUST_SERVER_CERTIFICATE: v.optional(v.string()),
  MSSQL_ALLOW_WRITES: v.optional(v.string()),
  MSSQL_MAX_ROWS: v.optional(v.string()),
  MSSQL_QUERY_TIMEOUT_MS: v.optional(v.string()),
});

export type AppConfig = {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  allowWrites: boolean;
  maxRows: number | undefined;
  queryTimeoutMs: number | undefined;
};

export function loadConfig(): AppConfig {
  const e = v.parse(envSchema, {
    MSSQL_SERVER: process.env.MSSQL_SERVER,
    MSSQL_USER: process.env.MSSQL_USER,
    MSSQL_PASSWORD: process.env.MSSQL_PASSWORD,
    MSSQL_DATABASE: process.env.MSSQL_DATABASE,
    MSSQL_PORT: process.env.MSSQL_PORT,
    MSSQL_ENCRYPT: process.env.MSSQL_ENCRYPT,
    MSSQL_TRUST_SERVER_CERTIFICATE: process.env.MSSQL_TRUST_SERVER_CERTIFICATE,
    MSSQL_ALLOW_WRITES: process.env.MSSQL_ALLOW_WRITES,
    MSSQL_MAX_ROWS: process.env.MSSQL_MAX_ROWS,
    MSSQL_QUERY_TIMEOUT_MS: process.env.MSSQL_QUERY_TIMEOUT_MS,
  } as v.InferInput<typeof envSchema>);

  const port = parseIntEnv(e.MSSQL_PORT, 1433);
  const maxRowsRaw = e.MSSQL_MAX_ROWS;
  const maxRows =
    maxRowsRaw === undefined || maxRowsRaw === ''
      ? undefined
      : Math.max(0, parseIntEnv(maxRowsRaw, 0));

  const timeoutRaw = e.MSSQL_QUERY_TIMEOUT_MS;
  const queryTimeoutMs =
    timeoutRaw === undefined || timeoutRaw === ''
      ? undefined
      : Math.max(0, parseIntEnv(timeoutRaw, 0));

  return {
    server: e.MSSQL_SERVER,
    port,
    user: e.MSSQL_USER,
    password: e.MSSQL_PASSWORD,
    database: e.MSSQL_DATABASE,
    encrypt: parseBool(e.MSSQL_ENCRYPT, true),
    trustServerCertificate: parseBool(e.MSSQL_TRUST_SERVER_CERTIFICATE, false),
    allowWrites: parseBool(e.MSSQL_ALLOW_WRITES, false),
    maxRows: maxRows === 0 ? undefined : maxRows,
    queryTimeoutMs: queryTimeoutMs === 0 ? undefined : queryTimeoutMs,
  };
}

export function mssqlDriverConfig(cfg: AppConfig): import('mssql').config {
  return {
    user: cfg.user,
    password: cfg.password,
    server: cfg.server,
    port: cfg.port,
    database: cfg.database,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: cfg.trustServerCertificate,
    },
    requestTimeout: cfg.queryTimeoutMs,
  };
}
