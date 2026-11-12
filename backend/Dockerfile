# syntax=docker/dockerfile:1

# --- Build -------------------------------------------------------------------
FROM rust:1-slim-bookworm AS build
WORKDIR /app

# Dependencies first, in their own layer: rebuilt only when Cargo.* change.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && echo "fn main() {}" > src/main.rs \
    && touch src/lib.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY src ./src
RUN touch src/main.rs src/lib.rs && cargo build --release --locked

# --- Runtime -----------------------------------------------------------------
FROM debian:bookworm-slim
# CA certificates: HTTPS calls to the Supabase JWKS endpoint.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home usss

COPY --from=build /app/target/release/usss-backend /usr/local/bin/usss-backend

USER usss
ENV HOST=0.0.0.0 \
    PORT=8080 \
    RUST_LOG=usss_backend=info,tower_http=info
EXPOSE 8080
CMD ["usss-backend"]
