module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/testHelpers.js'],
  clearMocks: true
};