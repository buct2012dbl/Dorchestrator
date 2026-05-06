function encryptSetting(value, safeStorage) {
  if (!value || !safeStorage?.isEncryptionAvailable()) return null;
  return safeStorage.encryptString(value).toString('base64');
}

function decryptSetting(value, safeStorage, log = () => {}) {
  if (!value || !safeStorage?.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch (error) {
    log('Failed to decrypt secure setting:', error.message);
    return null;
  }
}

function writeSecureAuthSettings(nextSettings, authToken, baseURL, { safeStorage }) {
  delete nextSettings.authToken;
  delete nextSettings.baseURL;

  const encryptedAuthToken = encryptSetting(authToken, safeStorage);
  const encryptedBaseURL = encryptSetting(baseURL, safeStorage);

  if (encryptedAuthToken) nextSettings.secureAuthToken = encryptedAuthToken;
  else delete nextSettings.secureAuthToken;

  if (encryptedBaseURL) nextSettings.secureBaseURL = encryptedBaseURL;
  else delete nextSettings.secureBaseURL;
}

function readSecureAuthSettings(savedSettings, { safeStorage, log } = {}) {
  const secureAuthToken = decryptSetting(savedSettings.secureAuthToken, safeStorage, log);
  const secureBaseURL = decryptSetting(savedSettings.secureBaseURL, safeStorage, log);
  const legacyAuthToken = typeof savedSettings.authToken === 'string' ? savedSettings.authToken : null;
  const legacyBaseURL = typeof savedSettings.baseURL === 'string' ? savedSettings.baseURL : null;
  const shouldMigrateLegacy = Boolean(legacyAuthToken || legacyBaseURL);

  return {
    authToken: secureAuthToken || legacyAuthToken,
    baseURL: secureBaseURL || legacyBaseURL,
    shouldMigrateLegacy,
  };
}

module.exports = {
  readSecureAuthSettings,
  writeSecureAuthSettings,
};
