# PostgreSQL 스키마와 마이그레이션

Mokpyo는 PostgreSQL을 사용합니다. `DATABASE_URL`에 `?schema=dashboard`를 지정하세요.
`schema.prisma`는 현재 모델을, `migrations/`는 적용 순서를 기록합니다.

## 새 설치

빈 데이터베이스를 준비하고 프로젝트 루트에서 실행합니다.

```bash
npx prisma generate
npx prisma migrate deploy
```

Docker 앱은 시작할 때 `migrate deploy`를 실행합니다. 로컬 개발의 `npm run dev:setup`도 DB 기동과 마이그레이션을 수행합니다.

## 스키마 변경

개발 데이터베이스에서 모델을 수정한 후 마이그레이션을 생성하고 변경 SQL을 검토합니다.

```bash
npx prisma migrate dev --name describe_the_change
npx prisma generate
```

`schema.prisma`와 생성된 마이그레이션을 함께 커밋합니다. 운영에는 검토한 마이그레이션을 `migrate deploy`로 적용하세요.
`db push`나 임의의 수동 ALTER로 마이그레이션 이력을 우회하지 마세요.

## 기존 데이터베이스를 가져오는 경우

이력 없는 기존 DB나 다른 버전의 설치에는 새 설치 명령만 적용해서는 안 됩니다.
먼저 백업과 별도 복원 환경을 확보하고, 실제 스키마·데이터·마이그레이션 이력을 비교해 이관 계획을 만드세요.
`0_init`은 최초 기준선이며 이후 마이그레이션도 있습니다. 스키마와 데이터가 일치하는지 확인하지 않고
`migrate resolve --applied`로 완료 처리하지 마세요. 조직 식별자와 멤버십 같은 데이터 이관은 별도 검토가 필요합니다.

DB 백업은 첨부파일을 포함하지 않습니다. 파일 저장소를 함께 백업하고 실제 복원 테스트를 수행하세요.
