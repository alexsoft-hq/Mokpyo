import { PrismaClient } from '@prisma/client';

// 단일 PrismaClient 싱글턴. 파일마다 new PrismaClient()를 만들면 인스턴스 수만큼
// 커넥션 풀이 상주해 공유 PostgreSQL 커넥션을 고갈시킨다. 전 모듈이 이 인스턴스를 공유한다.
// tsx watch 등 개발 중 핫리로드로 모듈이 재평가될 때 인스턴스가 누적되지 않도록 globalThis에 캐시한다.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
