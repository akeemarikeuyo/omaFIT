// Test setup: an in-memory AsyncStorage, so storage reads in tests start empty (default settings, no logs).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
