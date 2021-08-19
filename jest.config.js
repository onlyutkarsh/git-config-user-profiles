const path = require('path');

module.exports = {
	roots: [path.join(__dirname, 'test')],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	testRegex: '\\.test\\.ts$',
	moduleFileExtensions: ['ts', 'js'],
	globals: {
		'ts-jest': {
			tsconfig: '<rootDir>/test/tsconfig.json'
		}
	},
	reporters: ['jest-junit'],
	collectCoverageFrom: [
		// This option requires collectCoverage to be set to true or Jest to be invoked with --coverage
		"!**/node_modules/**",
		"src/*.ts"
	]
};
