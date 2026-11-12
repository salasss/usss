# usss.

> Pour nous deux, uniquement.

**usss** est une application Android intime réservée à deux personnes :
un espace partagé, une bulle de discussion en temps réel et un album de souvenirs.

## Architecture

| Dossier              | Rôle                    | Stack                                   |
| -------------------- | ----------------------- | --------------------------------------- |
| `mobile/`            | Application Android     | React Native · Expo · TypeScript        |
| `backend/`           | API & temps réel        | Rust · Axum · Tokio · SQLx              |
| `supabase/`          | Base de données & Auth  | PostgreSQL · Row Level Security · OAuth |
| `.github/workflows/` | CI/CD                   | GitHub Actions → APK Android            |

## Sécurité

Aucun secret n'est versionné : clés API, tokens Supabase, keystores Android et
fichiers `.env` restent en local ou dans les *secrets* GitHub. Chaque dossier
fournit un fichier `.env.example` à copier.
