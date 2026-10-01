/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '\\.spec\\.ts$',
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
};
