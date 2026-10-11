import parser from '@typescript-eslint/parser';
import sonarjs from 'eslint-plugin-sonarjs';

// Pre-commit-gate ESLint config: the SonarJS recommended ruleset, run only on
// staged files by scripts/hooks/pre-commit. Deliberately separate from
// scripts/eslint.config.mjs so the SARIF workflow's isolated toolchain and its
// findings set are unchanged.
export default [
	{ ignores: [
		'**/node_modules/**', '.svelte-kit/**', '.agents/**', '.stryker-tmp/**', 'build/**', '.netlify/**', 'reports/**', '.tools/**', '.codacy/**',
		// Same rationale as .codacy.yml: rules meant for production code trip on
		// normal test patterns (spawnSync('git', ...) → no-os-command-from-path).
		'**/*.test.ts',
		'**/*.test.mjs'
	] },
	{
		...sonarjs.configs.recommended,
		files: ['src/**/*.{js,ts}', 'scripts/**/*.{js,mjs,ts}', 'e2e/**/*.{ts,mjs}', '*.{js,mjs,ts}'],
		languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } }
	}
];
