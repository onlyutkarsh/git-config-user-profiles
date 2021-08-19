module.exports = {
	ignorePatterns: [ '**/*.d.ts', '**/*.test.ts', '**/*.js' ],
	parser: '@typescript-eslint/parser',
	extends: [ 'plugin:@typescript-eslint/recommended' ],
	plugins: [],
	parserOptions: {
		ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
		sourceType: 'module' // Allows for the use of imports
	},
	rules: {
		'@typescript-eslint/no-use-before-define': 'off',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/prefer-const': 'off',
		'@typescript-eslint/no-empty-function': 'off',
		"@typescript-eslint/no-unused-vars": 'warn'
		// Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
		// e.g. "@typescript-eslint/explicit-function-return-type": "off",
	}
};
