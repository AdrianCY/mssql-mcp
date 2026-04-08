# mssql-mcp

MCP server (stdio) that connects to Microsoft SQL Server using the `mssql` driver. Tool arguments are defined and validated with [Valibot](https://valibot.dev); JSON Schema for clients is generated with `@valibot/to-json-schema`.

**Implementation note:** This project uses the low-level `@modelcontextprotocol/sdk` `Server` class rather than `McpServer`, because the current SDK’s `McpServer.registerTool` path is built around Zod for schema export and validation. Tools are registered with `ListTools` / `tools/call` handlers and Valibot parsing inside the handlers.

## Tools

- **`mssql_query`** — Run a T-SQL batch; returns `recordsets` and `rowsAffected`. Honors `MSSQL_MAX_ROWS` via `SET ROWCOUNT` when set.
- **`mssql_list_tables`** — Base tables from `INFORMATION_SCHEMA.TABLES`, optional schema filter.
- **`mssql_describe_table`** — Column metadata from `INFORMATION_SCHEMA.COLUMNS`.

## Environment variables

See [`.env.example`](.env.example). Required: `MSSQL_SERVER`, `MSSQL_USER`, `MSSQL_PASSWORD`, `MSSQL_DATABASE`.

- **`MSSQL_ALLOW_WRITES`** — Default off. When off, a heuristic blocks common write/DDL/exec keywords (not a substitute for DB permissions).
- **`MSSQL_MAX_ROWS`** — When set, wraps batches in `SET ROWCOUNT` for `mssql_query`.
- **`MSSQL_ENCRYPT`** / **`MSSQL_TRUST_SERVER_CERTIFICATE`** — Passed through to the driver (`encrypt` defaults to true).

## Build and run

```bash
pnpm install
pnpm run build
pnpm start
```

Development (no separate build):

```bash
pnpm dev
```

Do not write logs to **stdout** when running under MCP; the protocol uses stdout. Errors on startup go to stderr via `console.error`.

## Cursor MCP configuration

Use the absolute path to your checkout. Example **user** MCP config fragment:

```json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["/home/adrian/code/mcp/dist/index.js"],
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

Use **`node` as `command`** (as above). Do **not** set `command` to `pnpm` or `npx`: if pnpm fails or prints to stdout, Cursor shows errors like `Unexpected token … "ERR_PNPM_"… is not valid JSON` because stdout must be JSON-RPC only.

### Dev mode without a build (still use `node`)

Set **`cwd`** to this repo so `node` can resolve `tsx` from `node_modules`:

```json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["--import", "tsx", "/home/adrian/code/mcp/src/index.ts"],
      "cwd": "/home/adrian/code/mcp",
      "env": { }
    }
  }
}
```

Fill `env` the same as in the example above. Run `pnpm install` locally first so `tsx` exists.
