import sql from 'mssql';
import * as v from 'valibot';
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

type ToolInputSchema = Tool['inputSchema'];

import { loadConfig, mssqlDriverConfig, type AppConfig } from './config.js';
import { assertReadOnlySql, wrapWithRowCount } from './readonly-sql.js';
import {
  mssqlDescribeTableSchema,
  mssqlListTablesSchema,
  mssqlQuerySchema,
  valibotToJsonSchema,
} from './schemas.js';

const SHARED_TOOL_PREAMBLE =
  'Connection uses MSSQL_* environment variables on the MCP server process. Arbitrary SQL is dangerous; prefer a read-only or narrowly scoped database user.';

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

async function runQuery(
  pool: sql.ConnectionPool,
  cfg: AppConfig,
  batch: string
): Promise<CallToolResult> {
  assertReadOnlySql(batch, cfg.allowWrites);
  const wrapped = wrapWithRowCount(batch, cfg.maxRows);
  const result = await pool.request().query(wrapped);
  const recordsets = result.recordsets as Record<string, unknown>[][];
  return jsonResult({
    rowsAffected: result.rowsAffected,
    recordsets,
    rowCountNote:
      cfg.maxRows !== undefined
        ? `ROWCOUNT capped at ${cfg.maxRows} per batch (SET ROWCOUNT).`
        : undefined,
  });
}

async function runListTables(
  pool: sql.ConnectionPool,
  schemaFilter: string | undefined
): Promise<CallToolResult> {
  const req = pool.request();
  req.input('schema', sql.NVarChar(128), schemaFilter ?? null);
  const q = `
SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND (@schema IS NULL OR TABLE_SCHEMA = @schema)
ORDER BY TABLE_SCHEMA, TABLE_NAME`;
  const result = await req.query(q);
  return jsonResult({ tables: result.recordset });
}

async function runDescribeTable(
  pool: sql.ConnectionPool,
  schema: string,
  table: string
): Promise<CallToolResult> {
  const req = pool.request();
  req.input('s', sql.NVarChar(128), schema);
  req.input('t', sql.NVarChar(128), table);
  const q = `
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  CHARACTER_MAXIMUM_LENGTH,
  NUMERIC_PRECISION,
  NUMERIC_SCALE,
  ORDINAL_POSITION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @s AND TABLE_NAME = @t
ORDER BY ORDINAL_POSITION`;
  const result = await req.query(q);
  return jsonResult({ columns: result.recordset });
}

function buildTools(): Tool[] {
  return [
    {
      name: 'mssql_query',
      description: `${SHARED_TOOL_PREAMBLE} Runs a T-SQL batch; returns recordsets as JSON.`,
      inputSchema: valibotToJsonSchema(mssqlQuerySchema) as ToolInputSchema,
    },
    {
      name: 'mssql_list_tables',
      description: `${SHARED_TOOL_PREAMBLE} Lists BASE TABLE rows from INFORMATION_SCHEMA.TABLES.`,
      inputSchema: valibotToJsonSchema(mssqlListTablesSchema) as ToolInputSchema,
    },
    {
      name: 'mssql_describe_table',
      description: `${SHARED_TOOL_PREAMBLE} Returns column metadata from INFORMATION_SCHEMA.COLUMNS.`,
      inputSchema: valibotToJsonSchema(mssqlDescribeTableSchema) as ToolInputSchema,
    },
  ];
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const pool = await sql.connect(mssqlDriverConfig(cfg));

  const server = new Server({ name: 'mssql-mcp', version: '1.0.0' });
  server.registerCapabilities({ tools: { listChanged: false } });

  const tools = buildTools();

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const name = request.params.name;
    const rawArgs = request.params.arguments ?? {};

    try {
      switch (name) {
        case 'mssql_query': {
          const args = v.parse(mssqlQuerySchema, rawArgs);
          return await runQuery(pool, cfg, args.sql);
        }
        case 'mssql_list_tables': {
          const args = v.parse(mssqlListTablesSchema, rawArgs);
          return await runListTables(pool, args.schema);
        }
        case 'mssql_describe_table': {
          const args = v.parse(mssqlDescribeTableSchema, rawArgs);
          return await runDescribeTable(pool, args.schema, args.table);
        }
        default:
          return toolError(`Unknown tool: ${name}`);
      }
    } catch (err) {
      if (v.isValiError(err)) {
        return toolError(`Invalid arguments: ${err.message}`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      return toolError(msg);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
