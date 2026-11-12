# APK de release et signature

La CI ([`.github/workflows/android.yml`](../.github/workflows/android.yml))
compile un APK de release à chaque push sur `main` qui touche `mobile/`.

## Installer l'APK sur un téléphone

1. GitHub → onglet **Actions** → workflow **Android APK** → dernier run vert.
2. En bas du run, section **Artifacts** : `usss-<version>-<commit>` (le résumé
   du job contient aussi un lien direct). Le téléchargement est un `.zip`
   contenant l'APK ; il faut être connecté à GitHub.
3. Copiez l'APK sur le téléphone (ou téléchargez-le depuis le téléphone),
   autorisez l'installation depuis cette source, puis ouvrez-le.

Les artefacts sont conservés 30 jours. Pour une version durable, poussez un
tag : `git tag v1.0.0 && git push origin v1.0.0`. L'APK est alors attaché à une
**Release GitHub**, téléchargeable directement, sans zip.

Par défaut, l'APK cible `arm64-v8a` (la quasi-totalité des téléphones
récents). Pour un vieux téléphone 32 bits, lancez le workflow à la main
(*Run workflow*) avec `armeabi-v7a,arm64-v8a`.

## Signature

| Secrets GitHub présents ?  | APK signé avec          | Usage                                  |
| -------------------------- | ----------------------- | -------------------------------------- |
| Non                        | keystore de **debug**   | tests sur vos téléphones               |
| Oui                        | keystore de **release** | version durable (et Play Store un jour) |

Android n'installe une mise à jour que si elle est signée avec la **même clé**.
En passant de debug à release, désinstallez une fois l'ancienne version.

### Créer le keystore de release (une seule fois)

```bash
scripts/android-keystore.sh            # crée usss-release.keystore (alias "usss")
```

Le script demande un mot de passe, puis affiche :

- les empreintes **SHA-1 / SHA-256** à enregistrer sur un client OAuth Android
  dans Google Cloud (voir [android-google-auth.md](android-google-auth.md)) ;
- les secrets à créer dans **Settings → Secrets and variables → Actions** :

| Secret                      | Valeur                                   |
| --------------------------- | ---------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 usss-release.keystore`       |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore                 |
| `ANDROID_KEY_ALIAS`         | `usss`                                   |
| `ANDROID_KEY_PASSWORD`      | même mot de passe (keystore PKCS12)      |

Rangez le fichier `.keystore` et son mot de passe dans un gestionnaire de mots
de passe. Ne les commitez jamais (`*.keystore` est ignoré par git).

### Comment ça marche

`android/` est régénéré à chaque build par `expo prebuild`. Le plugin
[`mobile/plugins/with-release-signing.js`](../mobile/plugins/with-release-signing.js)
ajoute une configuration de signature `release` qui lit
`USSS_UPLOAD_STORE_FILE`, `USSS_UPLOAD_STORE_PASSWORD`, `USSS_UPLOAD_KEY_ALIAS`
et `USSS_UPLOAD_KEY_PASSWORD` (propriétés Gradle ou variables d'environnement).
En CI, le keystore est décodé dans un dossier temporaire du runner, puis
supprimé en fin de job. La signature de l'APK est vérifiée avec `apksigner`.

Pour signer un build local :

```bash
cd mobile && npx expo prebuild --platform android
USSS_UPLOAD_STORE_FILE=/chemin/usss-release.keystore \
USSS_UPLOAD_STORE_PASSWORD=*** USSS_UPLOAD_KEY_ALIAS=usss USSS_UPLOAD_KEY_PASSWORD=*** \
  ./android/gradlew -p android assembleRelease
```
