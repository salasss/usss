const { existsSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Firebase configuration of the Android app, needed for push notifications.
 * It contains an API key, so it is never committed: CI writes it from the
 * GOOGLE_SERVICES_JSON secret (docs/push-notifications.md). Without it the
 * app still builds and runs, only without notifications.
 */
const GOOGLE_SERVICES_FILE = './google-services.json';

/**
 * Everything else lives in app.json.
 * @param {import('expo/config').ConfigContext} context
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config, projectRoot }) => {
  const withFirebase = existsSync(join(projectRoot, GOOGLE_SERVICES_FILE));
  return {
    ...config,
    name: config.name ?? 'usss',
    slug: config.slug ?? 'usss',
    android: {
      ...config.android,
      ...(withFirebase ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
    },
  };
};
