# syntax=docker/dockerfile:1

# =============================================================================
# Mokpyo 컨테이너 이미지
#   builder — 프론트엔드(dist/)와 서버 번들(server/production.cjs) 생성
#   deps    — 런타임 의존성만 설치(devDependencies 제외) + Prisma 클라이언트 생성
#   runner  — 위 둘의 산출물만 담은 실행 이미지
# =============================================================================

# --- builder ----------------------------------------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Prisma 엔진 다운로드에 OpenSSL 이 필요하다.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
RUN npx prisma generate

COPY . .
# 컨테이너는 루트 경로(/)로 서빙한다. 서브디렉터리 배포는 build 스크립트를 쓴다.
RUN npm run build:root \
 && npm run build:server

# --- deps (런타임 의존성만) ---------------------------------------------------
FROM node:24-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
RUN npx prisma generate

# --- runner -----------------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app

# openssl: Prisma 쿼리 엔진 / curl: HEALTHCHECK
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3001 \
    UPLOADS_DIR=/app/uploads

COPY --from=deps  /app/node_modules      ./node_modules
COPY --from=builder /app/dist            ./dist
COPY --from=builder /app/server/production.cjs ./server/production.cjs
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY package.json package-lock.json LICENSE ./
COPY docs/THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/uploads \
 && chown -R node:node /app

USER node
VOLUME ["/app/uploads"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
