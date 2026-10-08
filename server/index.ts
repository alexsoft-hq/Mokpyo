// 개발 엔트리포인트(tsx watch). 앱 본체는 ./app 에 있다 — 엔드포인트를 여기 추가하지 않는다.
import { startServer } from './app';

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
