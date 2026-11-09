import { expect, test } from 'vitest';
import { formatRpm } from './youtube-money-format';

test('formatRpm shows the decimals a visitor typed, so the formula reproduces the result', () => {
	expect(formatRpm(3.456)).toBe('$3.456');
	expect(formatRpm(3.5)).toBe('$3.50');
	expect(formatRpm(0.004)).toBe('$0.004');
	expect(formatRpm(1000)).toBe('$1,000.00');
	expect(formatRpm(3.123456)).toBe('$3.123456');
});
