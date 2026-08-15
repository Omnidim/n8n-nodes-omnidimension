import { defineConfig } from 'eslint/config';
import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import n8nNodesPlugin from 'eslint-plugin-n8n-nodes-base';
import parser from '@typescript-eslint/parser';

// Mirrors the config in @n8n/scan-community-package, which is the gate that
// decides whether n8n accepts a submission. Keep the off-overrides identical to
// the scanner's: n8n-nodes-base and @n8n/community-nodes disagree in a few
// places (notably `['main']` vs NodeConnectionTypes.Main) and the scanner's
// choice is the one that counts.
export default defineConfig(
	{ ignores: ['dist/**', 'node_modules/**'] },
	n8nCommunityNodesPlugin.configs.recommended,
	{ rules: { 'no-console': 'error' } },
	{ plugins: { 'n8n-nodes-base': n8nNodesPlugin } },
	{
		files: ['package.json'],
		rules: { ...n8nNodesPlugin.configs.community.rules },
	},
	{
		files: ['**/credentials/**/*.ts'],
		rules: {
			...n8nNodesPlugin.configs.credentials.rules,
			'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			'n8n-nodes-base/cred-class-field-type-options-password-missing': 'off',
		},
	},
	{
		files: ['**/nodes/**/*.ts'],
		rules: {
			...n8nNodesPlugin.configs.nodes.rules,
			'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
			'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
			'n8n-nodes-base/node-param-type-options-max-value-present': 'off',
		},
	},
	{ files: ['**/*.json'], languageOptions: { parser } },
	{ files: ['**/*.ts'], languageOptions: { parser } },
);
