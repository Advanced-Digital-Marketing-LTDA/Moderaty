import { expect, test } from 'vitest';
import { RPM_DECIMALS } from './youtube-money';
import { formatCount, formatRpm, formatUsd } from './youtube-money-format';

test('formatRpm shows the decimals a visitor typed, so the formula reproduces the result', () => {
	expect(formatRpm(3.456)).toBe('$3.456');
	expect(formatRpm(3.5)).toBe('$3.50');
	expect(formatRpm(0.004)).toBe('$0.004');
	expect(formatRpm(1000)).toBe('$1,000.00');
});

test('formatRpm shows every decimal the parser accepts', () => {
	const digits = '1'.repeat(RPM_DECIMALS);
	expect(formatRpm(Number(`1.${digits}`))).toBe(`$1.${digits}`);
});

test('formatUsd shows whole cents and says so below half a cent instead of printing $0.00', () => {
	expect(formatUsd(1234.5)).toBe('$1,234.50');
	expect(formatUsd(0)).toBe('$0.00');
	expect(formatUsd(0.004)).toBe('less than $0.01');
	expect(formatUsd(0.005)).toBe('$0.01');
});

test('formatCount groups thousands', () => {
	expect(formatCount(250000)).toBe('250,000');
});
