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
	collectCoverage: true,
    coverageDirectory: '<rootDir>/test/reports',
    coverageReporters: ['json', 'text', 'lcov', 'clover'],
	reporters: [
		'default', 
		'jest-junit'
	],
	collectCoverageFrom: [
		// This option requires collectCoverage to be set to true or Jest to be invoked with --coverage
		"!**/node_modules/**",
		"src/*.ts"
	]
};
