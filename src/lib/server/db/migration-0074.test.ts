import { createClient } from '@libsql/client';
import { expect, test } from 'vitest';
import { migrationStatements } from './migrationTestUtils';

test('free dry-run migration adds a nullable organizations column and leaves existing organizations unspent', async () => {
	const client = createClient({ url: 'file::memory:' });
	try {
		await client.executeMultiple(
			"CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, credits_remaining INTEGER); INSERT INTO organizations (id, name, credits_remaining) VALUES ('org-1', 'Org', 0);"
		);
		for (const statement of migrationStatements('0074_free_dry_run_used_at.sql')) await client.execute(statement);
		expect((await client.execute('SELECT id, name, credits_remaining, free_dry_run_used_at FROM organizations')).rows).toEqual([
			{ id: 'org-1', name: 'Org', credits_remaining: 0, free_dry_run_used_at: null }
		]);
		const column = (await client.execute("PRAGMA table_info('organizations')")).rows.find((row) => row.name === 'free_dry_run_used_at');
		expect(column).toBeDefined();
		expect(String(column?.type).toUpperCase()).toBe('TEXT');
		expect(column?.notnull).toBe(0);
		expect((await client.execute('PRAGMA integrity_check')).rows).toEqual([{ integrity_check: 'ok' }]);
	} finally {
		client.close();
	}
});
