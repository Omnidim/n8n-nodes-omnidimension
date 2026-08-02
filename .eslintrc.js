module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: { sourceType: 'module' },
	ignorePatterns: ['dist/**', 'node_modules/**', '*.js'],
	overrides: [
		{
			files: ['credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
		},
		{
			files: ['nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
	],
};
