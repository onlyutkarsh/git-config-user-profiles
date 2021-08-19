module.exports = {
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
	collectCoverageFrom: [
		'src/*.ts'
	]
};
