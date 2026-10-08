#!/bin/sh
# 컨테이너 시작: 마이그레이션을 먼저 적용한 뒤 서버를 띄운다.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL 이 설정되지 않았습니다." >&2
  exit 1
fi

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] starting Mokpyo server on port ${PORT:-3001}"
exec node server/production.cjs
