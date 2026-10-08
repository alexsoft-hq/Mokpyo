// 서버 환경변수 검증·해석. 앱 부트 시 한 번만 호출한다.
import fs from 'fs';
import path from 'path';
import type { CorsOptions } from 'cors';

const INSECURE_DEFAULTS = new Set(['', 'default-secret', 'default-secret-change-this', 'change-this', 'changeme']);

function readPackageVersion(): string {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version || 'dev';
  } catch {
    return 'dev';
  }
}

export const APP_VERSION = process.env.APP_VERSION || readPackageVersion();

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * 운영에서 시크릿이 비어 있거나 소스 폴백값이면 기동을 거부한다.
 * 개발에서는 경고만 남긴다(로컬 편의).
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const problems: string[] = [];

  if (!env.DATABASE_URL) problems.push('DATABASE_URL 이 비어 있습니다.');
  for (const key of ['JWT_SECRET', 'SESSION_SECRET'] as const) {
    const value = (env[key] || '').trim();
    if (INSECURE_DEFAULTS.has(value)) problems.push(`${key} 가 비어 있거나 기본값입니다. 32자 이상 무작위 문자열을 설정하세요.`);
    else if (value.length < 16) problems.push(`${key} 가 너무 짧습니다(최소 16자).`);
  }
  if (isProduction() && !env.APP_URL) problems.push('APP_URL 이 비어 있습니다(초대·비밀번호 재설정 메일 링크에 필요).');

  if (problems.length === 0) return;

  const message = ['환경변수 설정 문제:', ...problems.map((p) => `  - ${p}`)].join('\n');
  if (isProduction()) {
    throw new Error(message);
  }
  console.warn(`⚠️  ${message}\n   (개발 환경이라 계속 진행합니다. 운영에서는 기동이 거부됩니다.)`);
}

/** 첨부파일 저장 경로. 개발(tsx, 프로젝트 루트 cwd)·운영(PROD_DIR cwd) 모두 cwd/uploads 를 쓴다. */
export function resolveUploadsDir(): string {
  return process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');
}

/**
 * CORS 정책.
 * - CORS_ORIGINS(쉼표 구분)가 있으면 그 오리진만 허용.
 * - 없으면 개발은 전체 허용, 운영은 동일 오리진만(CORS 헤더 미발급).
 */
export function corsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const origins = (env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    return { origin: origins, credentials: true };
  }
  return isProduction() ? { origin: false } : { origin: true };
}
