const test = require('node:test');
const assert = require('node:assert/strict');

const {
  readSecureAuthSettings,
  writeSecureAuthSettings,
} = require('../../src/main/secureAuthSettings');

function createSafeStorage() {
  return {
    isEncryptionAvailable() {
      return true;
    },
    encryptString(value) {
      return Buffer.from(`encrypted:${value}`);
    },
    decryptString(buffer) {
      const value = buffer.toString();
      if (!value.startsWith('encrypted:')) {
        throw new Error('invalid cipher text');
      }
      return value.slice('encrypted:'.length);
    },
  };
}

function encrypted(value) {
  return Buffer.from(`encrypted:${value}`).toString('base64');
}

test('readSecureAuthSettings falls back per field when only auth token is encrypted', () => {
  const result = readSecureAuthSettings({
    secureAuthToken: encrypted('secure-token'),
    baseURL: 'https://legacy.example.com',
  }, { safeStorage: createSafeStorage() });

  assert.deepEqual(result, {
    authToken: 'secure-token',
    baseURL: 'https://legacy.example.com',
    shouldMigrateLegacy: true,
  });
});

test('readSecureAuthSettings falls back per field when only base URL is encrypted', () => {
  const result = readSecureAuthSettings({
    authToken: 'legacy-token',
    secureBaseURL: encrypted('https://secure.example.com'),
  }, { safeStorage: createSafeStorage() });

  assert.deepEqual(result, {
    authToken: 'legacy-token',
    baseURL: 'https://secure.example.com',
    shouldMigrateLegacy: true,
  });
});

test('readSecureAuthSettings falls back to legacy values when secure decryption fails', () => {
  const messages = [];
  const result = readSecureAuthSettings({
    authToken: 'legacy-token',
    baseURL: 'https://legacy.example.com',
    secureAuthToken: Buffer.from('bad-token').toString('base64'),
  }, {
    safeStorage: createSafeStorage(),
    log: (...args) => messages.push(args),
  });

  assert.deepEqual(result, {
    authToken: 'legacy-token',
    baseURL: 'https://legacy.example.com',
    shouldMigrateLegacy: true,
  });
  assert.equal(messages.length, 1);
});

test('writeSecureAuthSettings removes plaintext fields and writes encrypted fields', () => {
  const settings = {
    authToken: 'legacy-token',
    baseURL: 'https://legacy.example.com',
  };

  writeSecureAuthSettings(settings, 'secure-token', 'https://secure.example.com', {
    safeStorage: createSafeStorage(),
  });

  assert.equal(settings.authToken, undefined);
  assert.equal(settings.baseURL, undefined);
  assert.equal(settings.secureAuthToken, encrypted('secure-token'));
  assert.equal(settings.secureBaseURL, encrypted('https://secure.example.com'));
});
