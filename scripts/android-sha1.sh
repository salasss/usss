#!/usr/bin/env bash
# Print the SHA-1 / SHA-256 fingerprints that the Android OAuth client needs
# in Google Cloud Console (package name + SHA-1 of the signing keystore).
#
# Usage:
#   scripts/android-sha1.sh                       # debug keystore from `expo prebuild`
#   KEYSTORE_PASSWORD=*** scripts/android-sha1.sh path/to/release.keystore alias
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
keystore="${1:-$root/mobile/android/app/debug.keystore}"
alias_name="${2:-androiddebugkey}"

if [[ ! -f "$keystore" ]]; then
  echo "Keystore not found: $keystore" >&2
  echo "Run 'npx expo prebuild --platform android' in mobile/ first, or pass a keystore path." >&2
  exit 1
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found: install a JDK (17 recommended) and add it to PATH." >&2
  exit 1
fi

password="${KEYSTORE_PASSWORD:-}"
if [[ -z "$password" && "$alias_name" == "androiddebugkey" ]]; then
  password="android" # well-known password of the Android debug keystore
fi

args=(-list -v -keystore "$keystore" -alias "$alias_name")
if [[ -n "$password" ]]; then
  args+=(-storepass "$password")
fi

echo "Keystore: $keystore (alias: $alias_name)"
keytool "${args[@]}" | grep -E '^\s*SHA(1|256):'
