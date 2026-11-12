#!/usr/bin/env bash
# Creates the release (upload) keystore that CI uses to sign the APK, then
# prints its fingerprints and the GitHub secrets to set.
#
# Usage: scripts/android-keystore.sh [output.keystore] [alias]
#
# Keep the keystore and its password in a safe place (password manager):
# Android only installs updates signed with the same key. Never commit them.
set -euo pipefail

out="${1:-usss-release.keystore}"
alias_name="${2:-usss}"

if [[ -e "$out" ]]; then
  echo "Refusing to overwrite $out" >&2
  exit 1
fi
if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found: install a JDK (17 recommended) and add it to PATH." >&2
  exit 1
fi

read -r -s -p "Keystore password (6+ characters): " password; echo
read -r -s -p "Confirm the password: " confirm; echo
if [[ "$password" != "$confirm" ]]; then
  echo "The passwords differ." >&2
  exit 1
fi
if (( ${#password} < 6 )); then
  echo "The password is too short." >&2
  exit 1
fi

# Passed through the environment so it never shows up in the process list.
export USSS_KEYSTORE_PASSWORD="$password"

keytool -genkeypair \
  -keystore "$out" -storetype PKCS12 \
  -alias "$alias_name" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass:env USSS_KEYSTORE_PASSWORD -keypass:env USSS_KEYSTORE_PASSWORD \
  -dname "CN=usss, O=usss"

echo
echo "Created $out (alias: $alias_name)"
echo
echo "Fingerprints to register on the Android OAuth client (Google Cloud):"
keytool -list -v -keystore "$out" -alias "$alias_name" \
  -storepass:env USSS_KEYSTORE_PASSWORD | grep -E '^\s*SHA(1|256):'

cat <<EOF

GitHub repository secrets (Settings > Secrets and variables > Actions):
  ANDROID_KEYSTORE_BASE64    base64 of $out
  ANDROID_KEYSTORE_PASSWORD  the password you just typed
  ANDROID_KEY_ALIAS          $alias_name
  ANDROID_KEY_PASSWORD       the same password (PKCS12 shares it)

With the GitHub CLI:
  base64 -w0 "$out" | gh secret set ANDROID_KEYSTORE_BASE64
  gh secret set ANDROID_KEYSTORE_PASSWORD
  gh secret set ANDROID_KEY_ALIAS --body "$alias_name"
  gh secret set ANDROID_KEY_PASSWORD
EOF
