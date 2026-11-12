# Connexion Google native sur Android

usss utilise la connexion Google **native** d'Android
(`@react-native-google-signin/google-signin`) : pas de navigateur, pas de
redirection. Google renvoie un *ID token* que l'app échange contre une session
Supabase, puis le backend Rust vérifie le JWT Supabase à chaque requête.

```
Compte Google ─► Google Play Services ─(ID token)─► app usss
app usss ─(signInWithIdToken)─► Supabase Auth ─(JWT)─► app ─(Bearer JWT)─► backend Rust
```

| Élément                       | Valeur                     |
| ----------------------------- | -------------------------- |
| Nom du package Android        | `com.salasss.usss`         |
| Audience de l'ID token        | ID client OAuth **Web**    |
| Validation package + SHA-1    | ID client OAuth **Android** |

## 1. Google Cloud Console

1. Créer un projet puis configurer l'**écran de consentement OAuth**
   (type *Externe*). Tant que l'app est en mode « Test », ajoutez vos deux
   adresses Google dans les utilisateurs test.
2. **Identifiants → Créer un ID client OAuth → Application Web**.
   Notez l'*ID client* (le `webClientId`) et le *code secret*.
3. **Identifiants → Créer un ID client OAuth → Android**, une fois par keystore :
   - Nom du package : `com.salasss.usss`
   - Empreinte du certificat SHA-1 : voir la section 3.

   Un client pour le keystore de **debug**, un autre pour le keystore de
   **release** utilisé par la CI. Sans empreinte enregistrée, Google répond
   `DEVELOPER_ERROR` au moment de la connexion.

## 2. Supabase

Dashboard → **Authentication → Sign In / Providers → Google** :

- *Enable Sign in with Google* : activé
- *Client IDs* : l'ID client **Web** (d'autres IDs peuvent suivre, séparés par des virgules)
- *Client Secret* : le code secret du client Web
- *Skip nonce checks* : désactivé (les ID tokens Android n'ont pas de nonce)

Recommandé pour une app à deux : désactiver le provider **Email**, puis
*Allow new users to sign up* une fois vos deux comptes créés.

En local, copiez `supabase/.env.example` vers `supabase/.env`, puis lancez
`npx supabase start`. La configuration correspondante est dans
[`supabase/config.toml`](../supabase/config.toml) (`[auth.external.google]`).

## 3. Récupérer l'empreinte SHA-1

| Keystore                                    | Commande |
| ------------------------------------------- | -------- |
| Debug (Expo prebuild, APK CI sans secrets)  | `scripts/android-sha1.sh` (après `npx expo prebuild` dans `mobile/`) |
| Release (CI signée)                         | `KEYSTORE_PASSWORD=*** scripts/android-sha1.sh chemin/usss-release.keystore usss` |
| Tous les variants via Gradle                | `cd mobile/android && ./gradlew signingReport` |
| Build EAS                                   | `npx eas-cli credentials -p android` |

`keytool` est fourni par le JDK (17 recommandé).

Le keystore de debug généré par `expo prebuild` est le keystore standard
d'Android, identique sur toutes les machines. Son empreinte est donc connue :

```
SHA-1   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
SHA-256 FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
```

Enregistrez-la sur un client OAuth Android pour que les APK signés en debug
(développement local, CI sans keystore de release) puissent se connecter.

## 4. Variables de l'application

Dans `mobile/.env` (jamais commité) et dans les *secrets* GitHub pour la CI :

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<projet>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon ou publishable>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<ID client Web>.apps.googleusercontent.com
```

La clé *anon/publishable* est publique par nature : la confidentialité du
couple repose sur les politiques Row Level Security de la base, pas sur cette clé.
