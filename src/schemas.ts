import { type JsonSchema, toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

/** MCP tool inputSchema: JSON Schema derived from Valibot (descriptions flow to clients). */
export function valibotToJsonSchema(
  schema: v.GenericSchema,
): Record<string, unknown> {
  const js = toJsonSchema(schema) as JsonSchema as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export const mssqlQuerySchema = v.object({
  sql: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      'T-SQL batch to run on the connected database. Credentials and safety flags come from server environment variables. Read-only mode blocks common write/DDL/exec patterns heuristically; use MSSQL_ALLOW_WRITES=true to lift that gate (still use a least-privilege SQL login).',
    ),
  ),
});

export const mssqlListTablesSchema = v.object({
  schema: v.optional(
    v.pipe(
      v.string(),
      v.description(
        'When set, restrict to this schema (e.g. dbo). When omitted, list base tables from all schemas.',
      ),
    ),
  ),
});

export const mssqlDescribeTableSchema = v.object({
  schema: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description('Schema name, typically dbo.'),
  ),
  table: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description('Table name (unquoted identifier).'),
  ),
});

export type MssqlQueryInput = v.InferOutput<typeof mssqlQuerySchema>;
export type MssqlListTablesInput = v.InferOutput<typeof mssqlListTablesSchema>;
export type MssqlDescribeTableInput = v.InferOutput<
  typeof mssqlDescribeTableSchema
>;
