import { createClient, type Client } from '@libsql/client';
import { expect, test } from 'vitest';
import { migrationStatements } from './migrationTestUtils';

const ADDED_COLUMNS = [
	{ table: 'comments', name: 'parent_id', type: 'TEXT' },
	{ table: 'channels', name: 'moderate_replies_since', type: 'TEXT' },
	{ table: 'channels', name: 'reply_sweep_boundary', type: 'TEXT' },
	{ table: 'channels', name: 'reply_sweep_page_token', type: 'TEXT' },
	{ table: 'channels', name: 'reply_sweep_last_at', type: 'TEXT' },
	{ table: 'channels', name: 'reply_sweep_shortfall', type: 'INTEGER' }
];

async function columnNames(client: Client, table: string): Promise<string[]> {
	return (await client.execute(`PRAGMA table_info('${table}')`)).rows.map((row) => String(row.name));
}

function addedTo(table: string): string[] {
	return ADDED_COLUMNS.filter((column) => column.table === table).map((column) => column.name);
}

test('reply moderation migration adds nullable columns and leaves existing rows untouched', async () => {
	const client = createClient({ url: 'file::memory:' });
	try {
		await client.executeMultiple(
			"CREATE TABLE channels (id TEXT PRIMARY KEY, title TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1); CREATE TABLE comments (id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL); INSERT INTO channels (id, title, active) VALUES ('UCchannel', 'Channel', 1); INSERT INTO comments (id, channel_id, text, status) VALUES ('c-1', 'UCchannel', 'Top level', 'approved');"
		);
		const channelsBefore = await columnNames(client, 'channels');
		const commentsBefore = await columnNames(client, 'comments');
		for (const statement of migrationStatements('0075_reply_moderation_columns.sql')) await client.execute(statement);

		expect(await columnNames(client, 'channels')).toEqual([...channelsBefore, ...addedTo('channels')]);
		expect(await columnNames(client, 'comments')).toEqual([...commentsBefore, ...addedTo('comments')]);
		expect((await client.execute('SELECT id, title, active FROM channels')).rows).toEqual([{ id: 'UCchannel', title: 'Channel', active: 1 }]);
		expect((await client.execute('SELECT id, channel_id, text, status FROM comments')).rows).toEqual([
			{ id: 'c-1', channel_id: 'UCchannel', text: 'Top level', status: 'approved' }
		]);
		expect((await client.execute('SELECT parent_id FROM comments')).rows).toEqual([{ parent_id: null }]);
		expect(
			(await client.execute('SELECT moderate_replies_since, reply_sweep_boundary, reply_sweep_page_token, reply_sweep_last_at, reply_sweep_shortfall FROM channels')).rows
		).toEqual([
			{ moderate_replies_since: null, reply_sweep_boundary: null, reply_sweep_page_token: null, reply_sweep_last_at: null, reply_sweep_shortfall: null }
		]);
		for (const { table, name, type } of ADDED_COLUMNS) {
			const info = (await client.execute(`PRAGMA table_info('${table}')`)).rows.find((row) => row.name === name);
			expect(info, `${table}.${name} exists`).toBeDefined();
			expect(String(info?.type).toUpperCase(), `${table}.${name} type`).toBe(type);
			expect(info?.notnull, `${table}.${name} nullable`).toBe(0);
			expect(info?.dflt_value, `${table}.${name} has no default`).toBeNull();
		}
		expect((await client.execute('PRAGMA integrity_check')).rows).toEqual([{ integrity_check: 'ok' }]);
	} finally {
		client.close();
	}
});
