/**
 * Best-effort read-only gate. Not a substitute for database permissions.
 */

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BULK)\b/i;

export class ReadOnlySqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlySqlError';
  }
}

export function stripSqlComments(text: string): string {
  let s = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/--[^\n\r]*/g, ' ');
  return s;
}

/** Masks single-quoted and N'...' string literals so keywords inside literals are ignored. */
export function maskSqlStringLiterals(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "'" && text[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (text[j] === "'") break;
        j++;
      }
      out += ' ';
      i = j < text.length ? j + 1 : text.length;
      continue;
    }
    if (ch === 'N' || ch === 'n') {
      if (text[i + 1] === "'") {
        let j = i + 2;
        while (j < text.length) {
          if (text[j] === "'" && text[j + 1] === "'") {
            j += 2;
            continue;
          }
          if (text[j] === "'") break;
          j++;
        }
        out += ' ';
        i = j < text.length ? j + 1 : text.length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

export function assertReadOnlySql(sql: string, allowWrites: boolean): void {
  if (allowWrites) return;
  const probe = maskSqlStringLiterals(stripSqlComments(sql));
  if (FORBIDDEN.test(probe)) {
    throw new ReadOnlySqlError(
      'Read-only mode: this batch contains a blocked keyword (INSERT, UPDATE, DELETE, MERGE, DDL, EXEC, etc.). Set MSSQL_ALLOW_WRITES=true to allow writes (still use a least-privilege login).',
    );
  }
}
