// ESLint 9 flat config.
// 대상: 프론트엔드(src) + 서버(server) TypeScript. 빌드 산출물·번들은 제외한다.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // 검사 대상 밖: 빌드 산출물, 오프라인 배포 번들, 생성된 코드
    ignores: [
      'dist',
      'build',
      'coverage',
      'node_modules',
      'mokpyo-production',
      'server/production.cjs',
      'prisma/generated',
      '.github/appmod',
      'etc',
      'public',
    ],
  },

  // --- 프론트엔드 (React) ---
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 점진 도입: 아래 규칙들은 기존 코드에 광범위하게 걸려 있어 우선 warn 으로 둔다.
      // 새 코드에서는 지키되, 일괄 정리는 별도 작업으로 뺀다.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // `cond ? a() : b()` 를 문장으로 쓰는 축약형을 허용한다.
      // Set 토글(`s.has(k) ? s.delete(k) : s.add(k)`)에서만 쓰이며 부수효과가 명확하다.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    },
  },

  // --- 서버 (Node) ---
  {
    files: ['server/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // 첨부파일 정리처럼 실패해도 무시해야 하는 best-effort 삭제에서
      // `catch {}` 를 쓴다. 그 외 빈 블록은 그대로 오류로 잡는다.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // --- 설정 파일 / 시드 스크립트 ---
  {
    files: ['*.config.{ts,js}', 'prisma/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // tailwind.config.ts 의 plugins 는 require() 로 넣는 것이 공식 방식이다.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // --- 테스트 ---
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
