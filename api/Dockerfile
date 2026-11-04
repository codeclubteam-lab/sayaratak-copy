# Production image for the API. Build from the repo root (the workspace needs packages/shared):
#   docker build -f api/Dockerfile -t sayaratak-api .
FROM oven/bun:1.4.2-slim AS deps
WORKDIR /app
# Manifests first so the install layer is cached until a dependency changes.
COPY package.json bun.lock bunfig.toml ./
COPY packages/shared/package.json packages/shared/
COPY api/package.json api/
COPY web/package.json web/
RUN bun install --frozen-lockfile --production --filter api

FROM oven/bun:1.4.2-slim
# pg_dump and pg_restore (8.11) must match the server's major version, 18 on Render Postgres.
# Debian's own repo stops at 17, so the client comes from the Postgres project's apt repo.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && . /etc/os-release \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY packages/shared/package.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY api/package.json api/tsconfig.json api/openapi.json api/
COPY api/src api/src
COPY api/scripts api/scripts
# /api/health/ready reads drizzle/meta/_journal.json, and db:migrate reads the SQL files.
COPY api/drizzle api/drizzle

USER bun
WORKDIR /app/api
EXPOSE 4000
CMD ["bun", "src/index.ts"]
