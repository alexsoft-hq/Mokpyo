#!/bin/bash

# PostgreSQL 데이터베이스 백업 스크립트 (서버에서 실행)
# 사용법: ./backup-db-server.sh

set -e

# 스크립트 디렉토리 경로
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 설정 파일 로드
if [ ! -f "$SCRIPT_DIR/.env.backup" ]; then
    echo "❌ .env.backup 파일이 없습니다!"
    echo ""
    echo "다음 명령으로 생성하세요:"
    echo "  cp $SCRIPT_DIR/.env.backup.example $SCRIPT_DIR/.env.backup"
    echo "  vi $SCRIPT_DIR/.env.backup  # DB 정보 입력"
    exit 1
fi

# 설정 읽기
source "$SCRIPT_DIR/.env.backup"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

# 타임스탬프
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mokpyo_backup_${TIMESTAMP}.sql"

echo "========================================="
echo "  PostgreSQL 데이터베이스 백업"
echo "========================================="
echo ""
echo "백업 시작: $(date)"
echo "데이터베이스: ${DB_HOST}:${DB_PORT}/${DB_NAME} (schema: ${DB_SCHEMA})"
echo "백업 파일: $BACKUP_FILE"
echo ""

# pg_dump로 백업
export PGPASSWORD="$DB_PASSWORD"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -n "$DB_SCHEMA" \
  --format=plain \
  --no-owner \
  --no-acl \
  -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # 압축
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo ""
    echo "✅ 백업 완료!"
    echo "파일: $BACKUP_FILE"
    echo "크기: $BACKUP_SIZE"
    echo ""

    # 오래된 백업 삭제
    echo "🗑️  오래된 백업 정리 중..."
    find "$BACKUP_DIR" -name "mokpyo_backup_*.sql.gz" -type f -mtime +${KEEP_DAYS} -delete

    # 남은 백업 파일 수
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/mokpyo_backup_*.sql.gz 2>/dev/null | wc -l)
    echo "✅ 정리 완료 (보관 중인 백업: ${BACKUP_COUNT}개, 최근 ${KEEP_DAYS}일)"
    echo ""
    echo "백업 완료: $(date)"
else
    echo "❌ 백업 실패!"
    exit 1
fi

unset PGPASSWORD
