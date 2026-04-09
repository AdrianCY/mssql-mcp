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

All variables are read from the MCP process environment (e.g. Cursor `env`). Booleans treat `1`, `true`, `yes`, `on` (case-insensitive) as true; anything else uses the default.

| Variable | Required | Default | Meaning |
|----------|----------|---------|---------|
| `MSSQL_SERVER` | yes | — | Hostname or IP of SQL Server |
| `MSSQL_USER` | yes | — | SQL login user |
| `MSSQL_PASSWORD` | yes* | — | SQL login password (*may be empty for some setups) |
| `MSSQL_DATABASE` | yes | — | Initial database |
| `MSSQL_PORT` | no | `1433` | TCP port |
| `MSSQL_ENCRYPT` | no | `true` | TLS `encrypt` (driver option) |
| `MSSQL_TRUST_SERVER_CERTIFICATE` | no | `false` | Trust self-signed / skip cert validation (dev only) |
| `MSSQL_ALLOW_WRITES` | no | `false` | If false/unset, blocks common write/DDL/exec patterns in `mssql_query` (heuristic only) |
| `MSSQL_MAX_ROWS` | no | *(no cap)* | Positive integer: wraps `mssql_query` batches with `SET ROWCOUNT`. `0` or invalid → treated as unset |
| `MSSQL_QUERY_TIMEOUT_MS` | no | *(driver default)* | Request timeout in ms for the driver. `0` or invalid → treated as unset |

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
pnpm build && pnpm start
pnpm dev
```

Use a read-only or least-privilege SQL login for day-to-day use.
