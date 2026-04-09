import assert from 'node:assert/strict';
import test from 'node:test';

import { assertReadOnlySql, ReadOnlySqlError } from '../src/readonly-sql.js';

test('assertReadOnlySql blocks write keywords in read-only mode', () => {
  assert.throws(
    () => assertReadOnlySql("UPDATE dbo.Users SET name = N'changed'", false),
    ReadOnlySqlError,
  );
});

test('assertReadOnlySql ignores blocked keywords inside strings and comments', () => {
  assert.doesNotThrow(() =>
    assertReadOnlySql(
      "SELECT 'update keyword in a string'; -- DELETE FROM dbo.Users\nSELECT N'insert';",
      false,
    ),
  );
});

test('assertReadOnlySql allows all batches when writes are enabled', () => {
  assert.doesNotThrow(() =>
    assertReadOnlySql('DELETE FROM dbo.Users WHERE id = 1;', true),
  );
});
