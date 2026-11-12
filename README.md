# usss.

> Pour nous deux, uniquement.

**usss** est une application Android intime réservée à deux personnes :
un espace partagé, une bulle de discussion en temps réel et un album de souvenirs.

| Notre espace                                   | Notre bulle                                   | Nos souvenirs                              |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| Avatars reliés, présence, instant du jour      | Messages, vocaux, photos, réactions, « Vu »   | Mosaïque de photos, favoris, filtres       |
| Humeurs (énergie, moral), petit mot            | « En train d'écrire », envoi hors ligne       | Projets à cocher, agenda partagé           |
| Compte à rebours jusqu'au prochain rendez-vous | Temps réel via le backend Rust                | Mises à jour en direct (Supabase Realtime) |

## Architecture

```
 Android (Expo)  ──Google Sign-In──►  Supabase Auth ──► JWT
       │  données, photos, vocaux (RLS)   ▲
       ├────────────────────────────────► Supabase (Postgres + Storage + Realtime)
       │  appairage + WebSocket (JWT)     ▲
       └────────────────────────────────► backend Rust (Axum) ──SQLx──┘
```

| Dossier              | Rôle                    | Stack                                        |
| -------------------- | ----------------------- | -------------------------------------------- |
| `mobile/`            | Application Android     | React Native · Expo SDK 58 · TypeScript      |
| `backend/`           | Appairage & temps réel  | Rust · Axum · Tokio · SQLx · WebSocket       |
| `supabase/`          | Base de données & Auth  | PostgreSQL · Row Level Security · pgTAP      |
| `.github/workflows/` | CI/CD                   | APK Android, tests base + API, image Docker  |

Un couple ne compte **jamais plus de deux personnes** : deux « sièges » par
couple et un couple par personne, garantis par des contraintes SQL. Toutes les
données passent par des politiques RLS testées (36 scénarios pgTAP).

## Essayer tout de suite

Chaque push sur `main` produit un APK téléchargeable dans l'onglet **Actions**
(voir [docs/android-release.md](docs/android-release.md)). Sans configuration,
l'application s'ouvre en **mode démo** avec des données d'exemple, pour
découvrir l'interface.

## Mise en route (version réelle)

1. **Supabase** : créez un projet (offre gratuite), puis appliquez le schéma :
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. **Google** : clients OAuth Web + Android (empreintes SHA-1) et provider
   Google dans Supabase → [docs/android-google-auth.md](docs/android-google-auth.md).
3. **Backend** : déployez l'image Docker du dossier `backend/`
   → [backend/README.md](backend/README.md#déploiement).
4. **Secrets GitHub** (*Settings → Secrets and variables → Actions*) :

   | Secret                             | Valeur                                    |
   | ---------------------------------- | ----------------------------------------- |
   | `EXPO_PUBLIC_SUPABASE_URL`         | URL du projet Supabase                    |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY`    | clé anon / publishable                    |
   | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | ID client OAuth **Web**                   |
   | `EXPO_PUBLIC_API_URL`              | URL publique du backend                   |
   | `ANDROID_KEYSTORE_*`               | signature release (optionnel) → [docs](docs/android-release.md) |

5. Poussez sur `main` : l'APK est construit, signé et publié en artefact.
   Installez-le sur vos deux téléphones, connectez-vous avec Google, créez
   votre bulle et partagez le code d'invitation.

## Développement local

| Partie   | Commandes                                                             |
| -------- | --------------------------------------------------------------------- |
| Mobile   | `cd mobile && npm install && npm run android` (Node 22.13+, JDK 17)  |
| Backend  | `cd backend && cp .env.example .env && cargo run`                     |
| Base     | `npx supabase start` puis `npx supabase test db`                      |

## Sécurité

Aucun secret n'est versionné : clés, tokens Supabase, keystores Android et
fichiers `.env` restent en local ou dans les *secrets* GitHub. Chaque dossier
fournit un fichier `.env.example`. Les médias sont privés (URLs signées de
courte durée), le backend vérifie les JWT Supabase (JWKS ou HS256) et n'écrit
jamais au nom d'une personne extérieure au couple.
