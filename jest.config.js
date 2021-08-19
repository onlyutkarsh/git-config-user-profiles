module.exports = {
	roots: ['./test'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	testRegex: '\\.test\\.ts$',
	moduleFileExtensions: ['ts', 'js'],
	globals: {
		'ts-jest': {
			tsconfig: 'test/tsconfig.json'
		}
	},
	collectCoverageFrom: [
		'src/*.ts'
	]
};
