// 과거에는 server/index.ts 와 server/production.ts 가 2,300줄짜리 복제본이었고, 이 테스트가 두 파일의
// 동기화를 감시했다. 지금은 server/app.ts 한 곳에만 앱이 있고 두 엔트리포인트는 그것을 import 만 한다.
// 이 테스트는 그 구조가 다시 무너지지 않도록(엔트리포인트에 라우트가 생기지 않도록) 지킨다.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f: string) => readFileSync(resolve(__dirname, f), 'utf8');

describe('server entrypoints delegate to server/app.ts', () => {
  for (const file of ['index.ts', 'production.ts']) {
    it(`${file} imports startServer from ./app and defines no routes`, () => {
      const src = read(file);
      expect(src).toMatch(/from '\.\/app'/);
      expect(src).toMatch(/startServer\(\)/);
      expect(src).not.toMatch(/app\.(get|post|put|patch|delete|use)\(/);
      expect(src.split('\n').length).toBeLessThan(30);
    });
  }

  it('app.ts owns the route pipeline', () => {
    const src = read('app.ts');
    for (const marker of [
      "app.use('/api/auth'",
      "app.use('/api', authenticateJWT, resolveOrganization, attachAuditLog)",
      'export const app',
      'export async function startServer',
    ]) {
      expect(src, `${marker} missing from app.ts`).toContain(marker);
    }
    expect(src).not.toMatch(/import\.meta/); // esbuild CJS 번들에서 깨지므로 금지
  });
});
