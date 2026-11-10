import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ env: { MODERATY_DEPLOYMENT: undefined as string | undefined } }));
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));

import { deploymentMode, requireDeploymentMode } from './deploymentMode';
import { isOfficialHosted } from './welcomeEnrollment';

beforeEach(() => {
	mocks.env.MODERATY_DEPLOYMENT = undefined;
});

describe('deploymentMode', () => {
	test('is undefined when the variable is unset or empty', () => {
		expect(deploymentMode()).toBeUndefined();
		mocks.env.MODERATY_DEPLOYMENT = '';
		expect(deploymentMode()).toBeUndefined();
	});

	test('parses both declared modes', () => {
		mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
		expect(deploymentMode()).toBe('official-hosted');
		mocks.env.MODERATY_DEPLOYMENT = 'self-hosted';
		expect(deploymentMode()).toBe('self-hosted');
	});

	test('throws on any other value', () => {
		mocks.env.MODERATY_DEPLOYMENT = 'hosted';
		expect(() => deploymentMode()).toThrow('MODERATY_DEPLOYMENT must be official-hosted or self-hosted');
	});
});

describe('requireDeploymentMode', () => {
	test('throws when the variable is unset instead of defaulting', () => {
		expect(() => requireDeploymentMode()).toThrow('MODERATY_DEPLOYMENT must be set to official-hosted or self-hosted');
	});

	test('returns the declared mode', () => {
		mocks.env.MODERATY_DEPLOYMENT = 'self-hosted';
		expect(requireDeploymentMode()).toBe('self-hosted');
		mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
		expect(requireDeploymentMode()).toBe('official-hosted');
	});
});

describe('isOfficialHosted keeps its welcome-email reading', () => {
	test('is false when unset, true only for official-hosted, and still throws on an invalid value', () => {
		expect(isOfficialHosted()).toBe(false);
		mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
		expect(isOfficialHosted()).toBe(true);
		mocks.env.MODERATY_DEPLOYMENT = 'self-hosted';
		expect(isOfficialHosted()).toBe(false);
		mocks.env.MODERATY_DEPLOYMENT = 'hosted';
		expect(() => isOfficialHosted()).toThrow('MODERATY_DEPLOYMENT must be official-hosted or self-hosted');
	});
});
