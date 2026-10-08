// 온보딩용 샘플 프로젝트. 새 워크스페이스가 비어 있을 때 "둘러보기" 데이터를 넣는다. 멱등(프로젝트 이름 기준).
import { prisma } from './prisma';
import { ensureDefaultStatusLabels, ANCHOR } from './statusSync';

export const SAMPLE_PROJECT_NAME = '샘플 프로젝트 · 제품 출시';

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

interface SampleGoal {
  title: string;
  description: string;
  status: keyof typeof ANCHOR;
  progress: number;
  size: 'xs' | 'small' | 'medium' | 'large' | 'xl';
  start: number; // 오늘 기준 일수
  due: number;
  categories: string[];
  owners: string[]; // 이름. '@me' 는 현재 사용자
  statusNote?: string;
  subGoals?: { title: string; progress: number; owner?: string; kr?: { target: number; current: number; unit: string } }[];
  note?: string;
}

const CATEGORIES = [
  { name: '기능 개발', color: '#3b82f6' },
  { name: '마케팅', color: '#ec4899' },
  { name: '운영', color: '#64748b' },
  { name: '리서치', color: '#8b5cf6' },
];

const GOALS: SampleGoal[] = [
  {
    title: '베타 사용자 50팀 확보', description: '출시 전 실제 팀의 사용 피드백을 모읍니다. 초대 링크와 온보딩 세션으로 전환율을 높입니다.',
    status: 'IN_PROGRESS', progress: 62, size: 'xl', start: -30, due: 25, categories: ['마케팅'], owners: ['@me', '김지우'],
    statusNote: '이번 주 12팀 추가. 온보딩 세션 참석률이 낮아 안내 메일을 개선 중입니다.',
    subGoals: [
      { title: '초대 대기 목록 200명 모집', progress: 80, kr: { target: 200, current: 160, unit: '명' } },
      { title: '온보딩 세션 6회 진행', progress: 50, kr: { target: 6, current: 3, unit: '회' } },
      { title: '피드백 인터뷰 20건', progress: 55, kr: { target: 20, current: 11, unit: '건' } },
    ],
    note: '피드백 요약은 매주 금요일 리서치 노트에 정리합니다.',
  },
  {
    title: '핵심 기능 안정화', description: '카드·테이블·보드에서 같은 목표를 편집했을 때 충돌 없이 반영되도록 동시 편집 처리를 마무리합니다.',
    status: 'IN_PROGRESS', progress: 45, size: 'large', start: -20, due: 20, categories: ['기능 개발'], owners: ['박서준'],
    subGoals: [
      { title: '낙관적 잠금 충돌 안내 UI', progress: 70 },
      { title: '변경 이력 상세 보기', progress: 30 },
    ],
  },
  {
    title: '온보딩 가이드 문서', description: '가입 후 10분 안에 첫 목표를 만들 수 있도록 단계별 가이드와 샘플을 제공합니다.',
    status: 'DONE', progress: 100, size: 'medium', start: -45, due: -5, categories: ['운영'], owners: ['정다은'],
  },
  {
    title: '요금제·결제 흐름 설계', description: 'Free/Pro/Business 플랜 한도와 업그레이드 경로를 정의하고 결제 사업자를 비교합니다.',
    status: 'AT_RISK', progress: 20, size: 'large', start: -10, due: 12, categories: ['리서치', '운영'], owners: ['@me'],
    statusNote: '결제 사업자 심사 일정이 늦어져 마감이 위험합니다. 대안 사업자 병행 검토 중.',
    subGoals: [{ title: '결제 사업자 3곳 비교표', progress: 60 }, { title: '플랜 한도 확정', progress: 0 }],
  },
  {
    title: '성능 개선: 목표 1,000개 화면 1초 내 로드', description: '큰 워크스페이스에서도 테이블·타임라인이 빠르게 뜨도록 조회를 최적화합니다.',
    status: 'NOT_STARTED', progress: 0, size: 'medium', start: 5, due: 40, categories: ['기능 개발'], owners: ['이민지'],
    subGoals: [{ title: '조회 쿼리 프로파일링', progress: 0, kr: { target: 1000, current: 2400, unit: 'ms' } }],
  },
  {
    title: '출시 발표 콘텐츠 제작', description: '랜딩 페이지 문구, 소개 영상 스크립트, 뉴스레터 초안을 준비합니다.',
    status: 'IN_PROGRESS', progress: 35, size: 'small', start: -7, due: 18, categories: ['마케팅'], owners: ['한은서'],
  },
  {
    title: '보안 점검 및 백업 훈련', description: '권한 검증, 비밀번호 정책, 일일 백업 복구 훈련을 분기마다 수행합니다.',
    status: 'ON_HOLD', progress: 10, size: 'small', start: -15, due: 30, categories: ['운영'], owners: ['강수진'],
    statusNote: '외부 점검 업체 일정 조율 중이라 잠시 보류합니다.',
  },
  {
    title: '경쟁 제품 사용성 비교', description: '주요 경쟁 제품 4종의 온보딩·보드·리포트 흐름을 비교해 차별점을 정리했습니다.',
    status: 'DONE', progress: 100, size: 'xs', start: -60, due: -20, categories: ['리서치'], owners: ['오소연'],
  },
];

export async function buildSampleProject(organizationId: string, userId: string, userName: string): Promise<{ projectId: string; created: boolean; goals: number }> {
  const existing = await prisma.project.findFirst({ where: { organizationId, name: SAMPLE_PROJECT_NAME }, select: { id: true, _count: { select: { goals: true } } } });
  if (existing) return { projectId: existing.id, created: false, goals: existing._count.goals };

  await ensureDefaultStatusLabels(organizationId);
  const labels = await prisma.statusLabel.findMany({ where: { organizationId } });
  const labelByName = new Map(labels.map((l) => [l.name, l]));

  const projectId = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        organizationId,
        name: SAMPLE_PROJECT_NAME,
        description: '둘러보기용 샘플입니다. 자유롭게 수정하거나 프로젝트 관리에서 삭제해도 됩니다.',
        dashboardTitle: '제품 출시',
        dashboardSubtitle: '샘플 워크스페이스',
      },
    });

    const categoryIds = new Map<string, string>();
    for (const c of CATEGORIES) {
      const created = await tx.category.create({ data: { name: c.name, color: c.color, projectId: project.id } });
      categoryIds.set(c.name, created.id);
    }

    // 현재 분기 사이클이 하나도 없으면 하나 만든다(사이클 필터가 비어 보이지 않게).
    const cycleCount = await tx.cycle.count({ where: { organizationId } });
    let cycleId: string | null = null;
    if (cycleCount === 0) {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0);
      const cycle = await tx.cycle.create({
        data: { organizationId, name: `${now.getFullYear()} Q${q + 1}`, type: 'quarter', startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) },
      });
      cycleId = cycle.id;
    }

    let order = 0;
    for (const g of GOALS) {
      const label = labelByName.get(ANCHOR[g.status]);
      const ownerNames = g.owners.map((o) => (o === '@me' ? userName : o));
      const goal = await tx.goal.create({
        data: {
          projectId: project.id,
          title: g.title,
          description: g.description,
          owner: ownerNames[0] || userName,
          progress: g.progress,
          size: g.size,
          startDate: day(g.start),
          dueDate: day(g.due),
          statusNote: g.statusNote ?? null,
          order: order++,
          statusId: label?.id ?? null,
          completed: label?.kind === 'done',
          onHold: label?.kind === 'on_hold',
          cycleId,
          categories: { connect: g.categories.map((name) => ({ id: categoryIds.get(name)! })) },
          goalOwners: {
            create: g.owners.map((o, i) => ({ ownerName: o === '@me' ? userName : o, userId: o === '@me' ? userId : null, order: i })),
          },
        },
      });
      for (const [i, sg] of (g.subGoals ?? []).entries()) {
        await tx.subGoal.create({
          data: {
            goalId: goal.id,
            title: sg.title,
            owner: sg.owner ?? ownerNames[0] ?? userName,
            progress: sg.progress,
            order: i,
            targetValue: sg.kr?.target ?? null,
            currentValue: sg.kr?.current ?? null,
            startValue: sg.kr ? 0 : null,
            unit: sg.kr?.unit ?? null,
          },
        });
      }
      if (g.note) {
        await tx.note.create({ data: { goalId: goal.id, content: g.note, isPinned: true } });
      }
    }
    return project.id;
  });

  return { projectId, created: true, goals: GOALS.length };
}
