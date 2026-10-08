# 운영 보조 도구

새 설치는 루트 [README](../README.md)의 Docker 절차를 먼저 참고하세요.
Docker 없이 빌드 배포본이 필요하면 루트의 `./prepare-release.sh`를 사용합니다.
대상 서버에서 의존성 설치와 Prisma 생성에 인터넷 연결이 필요합니다.

## PostgreSQL 백업

`backup-db-server.sh`는 `.env.backup`에 지정한 PostgreSQL 스키마를 `pg_dump`로 내보내고 gzip으로 압축합니다.
`KEEP_DAYS`보다 오래된 `mokpyo_backup_*.sql.gz` 파일을 백업 디렉터리에서 삭제합니다.

```bash
cd scripts
cp .env.backup.example .env.backup
# 실제 DB 연결 값, BACKUP_DIR, KEEP_DAYS를 편집합니다.
chmod 600 .env.backup
./backup-db-server.sh
```

실행 호스트에는 대상 PostgreSQL 버전과 호환되는 `pg_dump`, gzip, DB 접근 권한이 필요합니다.
설정 파일은 셸에서 읽으므로 신뢰하는 운영자만 수정할 수 있게 하세요.
예약 실행은 운영 환경의 스케줄러에서 별도로 구성합니다. 설정과 백업 파일을 공개 저장소에 넣지 마세요.

이 백업은 **지정한 DB 스키마만** 포함합니다. 로컬 uploads 디렉터리, Amazon S3 객체,
환경변수와 외부 서비스 설정은 별도로 보관해야 합니다. 삭제 사고에 대비해 다른 저장 위치와 보관 정책도 마련하세요.

복원은 먼저 격리된 빈 테스트 DB에서 수행하고 스키마, 계정·조직 관계, 목표 데이터와 파일 접근을 확인하세요.
실제 운영 DB에 덤프를 바로 덮어쓰지 마세요. 백업 파일 생성 성공과 복구 성공은 서로 다른 검증입니다.
