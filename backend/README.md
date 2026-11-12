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

## Routes

| Méthode | Route     | Auth | Description          |
| ------- | --------- | ---- | -------------------- |
| GET     | `/health` | non  | Sonde de disponibilité |
