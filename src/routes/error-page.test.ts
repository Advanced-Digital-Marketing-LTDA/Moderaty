import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';

const mockPage = vi.hoisted(() => ({ status: 500, error: { message: '<script>private server detail</script>', supportReference: 'support-123' } }));
vi.mock('$app/state', () => ({ page: mockPage }));

import ErrorPage from './+error.svelte';

test('unexpected error UI uses the shared error state and keeps its private details out of the response', () => {
	const body = render(ErrorPage).body;
	expect(body).toMatch(/<div class="error-box[^\"]*"/);
	expect(body).toContain('role="alert"');
	expect(body).toContain('support-123');
	expect(body).not.toContain('<script>private server detail</script>');
	expect(body).toContain('aria-labelledby="error-title"');
});
