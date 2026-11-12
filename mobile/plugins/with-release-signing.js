// Signs release builds with the upload keystore when one is provided, through
// Gradle properties or environment variables (CI secrets). Without it, release
// builds stay signed with the debug keystore so they can still be installed.
//
//   USSS_UPLOAD_STORE_FILE      absolute path of the keystore
//   USSS_UPLOAD_STORE_PASSWORD  keystore password
//   USSS_UPLOAD_KEY_ALIAS       key alias
//   USSS_UPLOAD_KEY_PASSWORD    key password
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = 'USSS_UPLOAD_STORE_FILE';

const RELEASE_SIGNING_CONFIG = `
        release {
            def uploadSetting = { String name -> project.findProperty(name) ?: System.getenv(name) }
            def uploadStoreFile = uploadSetting('USSS_UPLOAD_STORE_FILE')
            if (uploadStoreFile) {
                storeFile file(uploadStoreFile)
                storePassword uploadSetting('USSS_UPLOAD_STORE_PASSWORD')
                keyAlias uploadSetting('USSS_UPLOAD_KEY_ALIAS')
                keyPassword uploadSetting('USSS_UPLOAD_KEY_PASSWORD')
            }
        }`;

function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const debugConfig = /signingConfigs \{\n([ \t]*)debug \{[\s\S]*?\n\1\}/;
  if (!debugConfig.test(gradle)) {
    throw new Error('with-release-signing: signingConfigs.debug not found in app/build.gradle');
  }
  let next = gradle.replace(debugConfig, (block) => `${block}${RELEASE_SIGNING_CONFIG}`);

  const releaseBuildType = /(buildTypes \{[\s\S]*?\n[ \t]*release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseBuildType.test(next)) {
    throw new Error('with-release-signing: release build type signing not found in app/build.gradle');
  }
  next = next.replace(
    releaseBuildType,
    '$1signingConfig signingConfigs.release.storeFile ? signingConfigs.release : signingConfigs.debug',
  );
  return next;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error('with-release-signing: only Groovy build.gradle files are supported');
    }
    modConfig.modResults.contents = addReleaseSigning(modConfig.modResults.contents);
    return modConfig;
  });
};

module.exports.addReleaseSigning = addReleaseSigning;
