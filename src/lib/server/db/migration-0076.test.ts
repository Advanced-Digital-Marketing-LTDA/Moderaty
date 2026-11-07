import { createClient } from '@libsql/client';
import { expect, test } from 'vitest';
import { migrationStatements } from './migrationTestUtils';

test('youtube quota migration creates the day-keyed meter with exact column shapes, a zero default and a unique day', async () => {
	const client = createClient({ url: 'file::memory:' });
	try {
		for (const statement of migrationStatements('0076_youtube_quota_usage.sql')) await client.execute(statement);

		const columns = (await client.execute("PRAGMA table_info('youtube_quota_usage')")).rows.map((row) => ({
			name: String(row.name),
			type: String(row.type).toUpperCase(),
			notnull: row.notnull,
			defaultValue: row.dflt_value,
			primaryKey: row.pk
		}));
		expect(columns).toEqual([
			{ name: 'day', type: 'TEXT', notnull: 1, defaultValue: null, primaryKey: 1 },
			{ name: 'units', type: 'INTEGER', notnull: 1, defaultValue: '0', primaryKey: 0 },
			{ name: 'exhausted_at', type: 'TEXT', notnull: 0, defaultValue: null, primaryKey: 0 }
		]);

		await client.execute("INSERT INTO youtube_quota_usage (day) VALUES ('2026-11-07')");
		expect((await client.execute('SELECT day, units, exhausted_at FROM youtube_quota_usage')).rows).toEqual([
			{ day: '2026-11-07', units: 0, exhausted_at: null }
		]);

		await expect(client.execute("INSERT INTO youtube_quota_usage (day, units) VALUES ('2026-11-07', 5)")).rejects.toThrow(/UNIQUE constraint failed/);
		expect((await client.execute('SELECT COUNT(*) AS n FROM youtube_quota_usage')).rows).toEqual([{ n: 1 }]);
		expect((await client.execute('PRAGMA integrity_check')).rows).toEqual([{ integrity_check: 'ok' }]);
	} finally {
		client.close();
	}
});
