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

## Couple : invitation et verrouillage à deux

1. `POST /couple` : la première personne crée le couple (siège 1) et reçoit un
   code d'invitation de 8 caractères (sans 0/O ni 1/I), valable 48 h.
2. `POST /couple/join` `{ "code": "K7PQ-2MXZ" }` : le ou la partenaire rejoint
   (siège 2). Le code est alors effacé : personne d'autre ne peut entrer.

La jonction se fait dans une transaction qui verrouille le couple
(`SELECT … FOR UPDATE`) ; les contraintes SQL (deux sièges par couple, un
couple par personne) tranchent les courses restantes. Si les deux partenaires
ont chacun créé un couple vide, celui qui saisit le code de l'autre quitte
automatiquement le sien.

| Erreur             | HTTP | Cas                                      |
| ------------------ | ---- | ---------------------------------------- |
| `already_paired`   | 409  | déjà dans un couple                      |
| `couple_complete`  | 409  | le couple a déjà deux membres            |
| `invite_not_found` | 404  | code inconnu ou déjà utilisé             |
| `invite_expired`   | 410  | code expiré : en générer un nouveau      |
| `not_paired`       | 404  | aucune bulle à renouveler                |

## Routes

| Méthode | Route            | Auth | Description                              |
| ------- | ---------------- | ---- | ---------------------------------------- |
| GET     | `/health`        | non  | Sonde de disponibilité                   |
| GET     | `/me`            | oui  | Utilisateur vu par le backend            |
| GET     | `/couple`        | oui  | Mon couple et ses membres (`null` sinon) |
| POST    | `/couple`        | oui  | Créer le couple et son code d'invitation |
| POST    | `/couple/invite` | oui  | Renouveler le code en attendant l'autre  |
| POST    | `/couple/join`   | oui  | Rejoindre avec un code                   |

## Tests

Les tests d'intégration du couple utilisent une base Supabase Postgres avec
les migrations appliquées ; ils sont ignorés sans `TEST_DATABASE_URL` :

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres cargo test
```
