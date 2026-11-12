# usss · backend

API HTTP et serveur temps réel de usss, en Rust (Axum + Tokio).

## Lancer en local

```bash
cp .env.example .env      # puis compléter les valeurs
cargo run                 # http://localhost:8080/health
cargo test
```

Sans toolchain Rust installée, avec Docker :

```bash
docker run --rm -it -p 8080:8080 -v "$PWD":/app -w /app rust:1-slim-bookworm cargo run
```

## Authentification

L'app envoie le jeton d'accès Supabase de l'utilisateur connecté :
`Authorization: Bearer <jwt>` (ou `?access_token=` pour une connexion WebSocket).
Le middleware `require_auth` vérifie :

- la signature : clés asymétriques du projet (JWKS, ES256/RS256, mises en
  cache) via `SUPABASE_URL`, ou secret HS256 historique via `SUPABASE_JWT_SECRET` ;
- l'expiration, l'audience `authenticated`, l'émetteur `<SUPABASE_URL>/auth/v1` ;
- le rôle `authenticated` : la clé publique `anon` n'ouvre aucune route.

L'algorithme est imposé par la clé et jamais par le jeton, ce qui empêche la
confusion d'algorithme.

## Routes

| Méthode | Route     | Auth | Description                     |
| ------- | --------- | ---- | ------------------------------- |
| GET     | `/health` | non  | Sonde de disponibilité          |
| GET     | `/me`     | oui  | Utilisateur vu par le backend   |
