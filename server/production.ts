// 운영 엔트리포인트. esbuild 가 ./app 까지 한 파일(production.cjs)로 번들한다.
// 엔드포인트·미들웨어는 server/app.ts 한 곳에만 둔다.
import { startServer } from './app';

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
