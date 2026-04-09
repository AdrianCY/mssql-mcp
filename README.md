# `@adriancy/mcp-mssql`

MCP server (stdio) for Microsoft SQL Server. Exposes tools so Cursor (or any MCP client) can list tables, describe columns, and run read-biased T-SQL.

## Use it in Cursor

1. Open **Cursor Settings → MCP** (or edit your MCP JSON).
2. Add a server block. Set `env` to your database (see [`.env.example`](.env.example)).

**From npm** (after the package is published):

```json
{
  "mcpServers": {
    "mssql": {
      "command": "npx",
      "args": ["-y", "@adriancy/mcp-mssql"],
      "env": {
        "MSSQL_SERVER": "localhost",
        "MSSQL_USER": "your_user",
        "MSSQL_PASSWORD": "your_password",
        "MSSQL_DATABASE": "your_database",
        "MSSQL_TRUST_SERVER_CERTIFICATE": "true"
      }
    }
  }
}
```

**From a local clone** (run `pnpm install && pnpm build` first):

```json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["/absolute/path/to/mssql-mcp/dist/index.js"],
      "env": {
        "MSSQL_SERVER": "localhost",
        "MSSQL_USER": "your_user",
        "MSSQL_PASSWORD": "your_password",
        "MSSQL_DATABASE": "your_database",
        "MSSQL_TRUST_SERVER_CERTIFICATE": "true"
      }
    }
  }
}
```

Use **`node`** for local files. Avoid **`pnpm`** as the MCP `command` — extra output on stdout can break the protocol.

Confirm the install name matches npm: `npm view @adriancy/mcp-mssql version`.

## Environment

All variables are read from the MCP process environment (e.g. Cursor `env`). Booleans treat `1`, `true`, `yes`, `on` (case-insensitive) as true and `0`, `false`, `no`, `off` as false. Invalid boolean and integer values fail startup validation.

| Variable | Required | Default | Meaning |
|----------|----------|---------|---------|
| `MSSQL_SERVER` | yes | — | Hostname or IP of SQL Server |
| `MSSQL_USER` | yes† | — | Login user (SQL auth, NTLM, Azure AD password); not used for `azure-active-directory-access-token` or service-principal-only flows |
| `MSSQL_PASSWORD` | yes*† | — | Login password (*may be empty for some setups) |
| `MSSQL_DATABASE` | yes | — | Initial database |
| `MSSQL_PORT` | no | `1433` | TCP port; omit when using `MSSQL_INSTANCE_NAME` (driver uses instance + SQL Browser) |
| `MSSQL_ENCRYPT` | no | `true` | TLS `encrypt`: `true`, `false`, or `strict` (TDS 8.0 / tedious) |
| `MSSQL_TRUST_SERVER_CERTIFICATE` | no | `false` | Trust self-signed / skip cert validation (dev only) |
| `MSSQL_TLS_SERVER_NAME` | no | — | Hostname for TLS validation when it differs from `MSSQL_SERVER` (e.g. connect by IP) |
| `MSSQL_TLS_CA_FILE` | no | — | Path to CA PEM; passed via `cryptoCredentialsDetails.ca` |
| `MSSQL_TLS_CERT_FILE` | no | — | Optional client cert PEM (mutual TLS) |
| `MSSQL_TLS_KEY_FILE` | no | — | Optional client private key PEM |
| `MSSQL_TLS_KEY_PASSPHRASE` | no | — | Passphrase for encrypted client key |
| `MSSQL_CONNECTION_TIMEOUT_MS` | no | *(driver default)* | Pool `connectionTimeout` (ms). `0` → unset |
| `MSSQL_DOMAIN` | no | — | Domain login (`config.domain` for SQL auth; required for `MSSQL_AUTH_TYPE=ntlm`) |
| `MSSQL_INSTANCE_NAME` | no | — | Named instance (`options.instanceName`); do not rely on `MSSQL_PORT` with this set |
| `MSSQL_MULTI_SUBNET_FAILOVER` | no | `false` | Availability-group style failover hint |
| `MSSQL_READ_ONLY_INTENT` | no | `false` | Read-only routing for AG secondaries |
| `MSSQL_MAX_RETRIES_ON_TRANSIENT_ERRORS` | no | — | Tedious `maxRetriesOnTransientErrors`; `0` → unset |
| `MSSQL_CONNECTION_RETRY_INTERVAL_MS` | no | — | Tedious `connectionRetryInterval`; `0` → unset |
| `MSSQL_POOL_MAX` | no | `10` | Pool max connections |
| `MSSQL_POOL_MIN` | no | `0` | Pool min connections |
| `MSSQL_POOL_IDLE_TIMEOUT_MS` | no | `30000` | `pool.idleTimeoutMillis` |
| `MSSQL_APP_NAME` | no | — | `options.appName` (server tracing) |
| `MSSQL_USE_UTC` | no | `true` | `options.useUTC` when set |
| `MSSQL_TDS_VERSION` | no | — | `7_1`, `7_2`, `7_3_A`, `7_3_B`, or `7_4` |
| `MSSQL_AUTH_TYPE` | no | — | `ntlm`, `azure-active-directory-password`, `azure-active-directory-access-token`, `azure-active-directory-service-principal-secret`, or unset/`default` for SQL login |
| `MSSQL_AZURE_CLIENT_ID` | no‡ | — | Azure AD app (client) ID where required |
| `MSSQL_AZURE_TENANT_ID` | no‡ | — | Tenant ID (optional for password auth, defaults `common`; required for service principal) |
| `MSSQL_AZURE_CLIENT_SECRET` | no‡ | — | Service principal secret |
| `MSSQL_AZURE_ACCESS_TOKEN` | no‡ | — | Pre-obtained token for access-token auth |
| `MSSQL_ALLOW_WRITES` | no | `false` | If false/unset, blocks common write/DDL/exec patterns in `mssql_query` (heuristic only) |
| `MSSQL_QUERY_TIMEOUT_MS` | no | *(driver default)* | Request timeout in ms for the driver. `0` → unset |

† Required for SQL authentication and for auth types that use interactive user login.  
‡ Required depending on `MSSQL_AUTH_TYPE`; see [`.env.example`](.env.example). NTLM on Node 17+ may need `--openssl-legacy-provider` (see [tedious FAQ](https://tediousjs.github.io/tedious/frequently-encountered-problems.html)).

See also [`.env.example`](.env.example).

## Tools

| Tool | Purpose |
|------|--------|
| `mssql_query` | Run T-SQL; returns rows and `rowsAffected` |
| `mssql_list_tables` | Tables in `INFORMATION_SCHEMA` |
| `mssql_describe_table` | Column metadata |

When `MSSQL_ALLOW_WRITES` is unset/false, obvious write/DDL patterns are blocked (heuristic only; use DB permissions for real safety).

## Develop

```bash
pnpm install
pnpm check
pnpm test
pnpm build && pnpm start
pnpm dev
```

Use `pnpm format` to apply Biome formatting fixes and `pnpm lint` to run lint rules without formatting.

Use a read-only or least-privilege SQL login for day-to-day use.
