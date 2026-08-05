export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {},
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  verbose: true,
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/models/database.js',
  ],
};
