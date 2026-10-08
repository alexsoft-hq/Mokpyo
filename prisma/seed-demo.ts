import 'dotenv/config';
import { Prisma, PrismaClient, MemberRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const demoPassword = process.env.DEMO_USER_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!demoPassword) {
  throw new Error('DEMO_USER_PASSWORD 환경변수가 필요합니다.');
}
if (!databaseUrl) {
  throw new Error('DATABASE_URL 환경변수가 필요합니다.');
}

const parsedDatabaseUrl = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(parsedDatabaseUrl.hostname)) {
  throw new Error(`데모 시드는 로컬 DB에서만 실행할 수 있습니다: ${parsedDatabaseUrl.hostname}`);
}

const ORG_SLUG = 'mokpyo-labs-demo';

const statusSpecs = [
  { key: 'todo', name: '시작 전', color: '#94a3b8', kind: 'active', order: 0, isSystem: true },
  { key: 'doing', name: '진행 중', color: '#3b82f6', kind: 'active', order: 1, isSystem: true },
  { key: 'review', name: '코드 리뷰', color: '#8b5cf6', kind: 'active', order: 2, isSystem: false },
  { key: 'validate', name: '고객 검증', color: '#06b6d4', kind: 'active', order: 3, isSystem: false },
  { key: 'risk', name: '위험', color: '#ef4444', kind: 'active', order: 4, isSystem: false },
  { key: 'deploy', name: '배포 대기', color: '#f97316', kind: 'active', order: 5, isSystem: false },
  { key: 'hold', name: '보류', color: '#f59e0b', kind: 'on_hold', order: 6, isSystem: true },
  { key: 'done', name: '완료', color: '#22c55e', kind: 'done', order: 7, isSystem: true },
] as const;

const memberSpecs = [
  { key: 'owner', email: 'yongmin@me.com', name: 'Yongmin', role: MemberRole.OWNER },
  { key: 'pm', email: 'jiwoo.pm@example.invalid', name: '김지우', role: MemberRole.ADMIN },
  { key: 'frontend', email: 'seojun.frontend@example.invalid', name: '박서준', role: MemberRole.MEMBER },
  { key: 'backend', email: 'minji.backend@example.invalid', name: '이민지', role: MemberRole.MEMBER },
  { key: 'ai', email: 'haneul.ai@example.invalid', name: '최하늘', role: MemberRole.MEMBER },
  { key: 'design', email: 'daeun.design@example.invalid', name: '정다은', role: MemberRole.MEMBER },
  { key: 'qa', email: 'taeho.qa@example.invalid', name: '윤태호', role: MemberRole.MEMBER },
  { key: 'devops', email: 'sujin.devops@example.invalid', name: '강수진', role: MemberRole.MEMBER },
  { key: 'success', email: 'eunseo.success@example.invalid', name: '한은서', role: MemberRole.MEMBER },
  { key: 'mobile', email: 'junho.mobile@example.invalid', name: '임준호', role: MemberRole.MEMBER },
  { key: 'research', email: 'soyeon.research@example.invalid', name: '오소연', role: MemberRole.MEMBER },
  { key: 'data', email: 'doyun.data@example.invalid', name: '문도윤', role: MemberRole.MEMBER },
  { key: 'security', email: 'yerin.security@example.invalid', name: '배예린', role: MemberRole.MEMBER },
  { key: 'support', email: 'hyunwoo.support@example.invalid', name: '송현우', role: MemberRole.MEMBER },
] as const;

const projectSpecs = [
  {
    key: 'strategy',
    id: 'demo-project-strategy',
    name: 'Mokpyo 제품 전략',
    description: '제품 방향, 핵심 지표, 분기별 투자 우선순위를 관리합니다.',
    subtitle: '2026 Product Strategy',
    parentKey: null,
  },
  {
    key: 'web',
    id: 'demo-project-web',
    name: '웹 플랫폼',
    description: '웹 애플리케이션의 핵심 경험과 협업 기능을 개발합니다.',
    subtitle: 'Web Platform Team',
    parentKey: 'strategy',
  },
  {
    key: 'mobile',
    id: 'demo-project-mobile',
    name: '모바일 앱',
    description: 'iOS·Android 모바일 경험과 푸시 알림을 구축합니다.',
    subtitle: 'Mobile Experience',
    parentKey: 'strategy',
  },
  {
    key: 'ai',
    id: 'demo-project-ai',
    name: 'AI 업무 자동화',
    description: '목표 작성, 리포트, 위험 감지를 돕는 AI 기능을 실험합니다.',
    subtitle: 'AI & Automation',
    parentKey: 'strategy',
  },
  {
    key: 'dx',
    id: 'demo-project-dx',
    name: '개발자 경험',
    description: 'CI/CD, 관측성, 개발 환경과 배포 안정성을 개선합니다.',
    subtitle: 'Developer Experience',
    parentKey: null,
  },
  {
    key: 'success',
    id: 'demo-project-success',
    name: '고객 성공',
    description: '온보딩, 고객 피드백, 지원 운영과 제품 도입을 관리합니다.',
    subtitle: 'Customer Success',
    parentKey: null,
  },
] as const;

const categoryTemplates = [
  { key: 'feature', name: '기능 개발', color: '#3b82f6' },
  { key: 'quality', name: '품질 개선', color: '#22c55e' },
  { key: 'tech', name: '기술 부채', color: '#f97316' },
  { key: 'research', name: '리서치', color: '#8b5cf6' },
  { key: 'operation', name: '운영', color: '#64748b' },
  { key: 'growth', name: '성장 실험', color: '#ec4899' },
  { key: 'security', name: '보안', color: '#ef4444' },
  { key: 'data', name: '데이터', color: '#06b6d4' },
] as const;

const priorityOptions = [
  { id: 'p_xl', label: '최고', color: '#ef4444' },
  { id: 'p_large', label: '높음', color: '#f97316' },
  { id: 'p_medium', label: '중간', color: '#eab308' },
  { id: 'p_small', label: '낮음', color: '#3b82f6' },
  { id: 'p_xs', label: '최저', color: '#9ca3af' },
];

const teamOptions = [
  { id: 'team_product', label: 'Product', color: '#8b5cf6' },
  { id: 'team_frontend', label: 'Frontend', color: '#3b82f6' },
  { id: 'team_backend', label: 'Backend', color: '#06b6d4' },
  { id: 'team_ai', label: 'AI/ML', color: '#ec4899' },
  { id: 'team_platform', label: 'Platform', color: '#64748b' },
  { id: 'team_design', label: 'Design', color: '#f59e0b' },
  { id: 'team_mobile', label: 'Mobile', color: '#14b8a6' },
  { id: 'team_security', label: 'Security', color: '#ef4444' },
  { id: 'team_data', label: 'Data', color: '#06b6d4' },
  { id: 'team_success', label: 'Customer Success', color: '#22c55e' },
];

const fieldTemplates = [
  { key: 'priority', name: '우선순위', type: 'priority', config: { options: priorityOptions } },
  { key: 'team', name: '담당 팀', type: 'dropdown', config: { options: teamOptions, multi: true } },
  { key: 'effort', name: '예상 공수', type: 'number', config: { unit: 'SP' } },
  { key: 'release', name: '목표 릴리스', type: 'date', config: {} },
  { key: 'lead', name: '기술 리드', type: 'person', config: {} },
  { key: 'riskNote', name: '리스크 메모', type: 'text', config: {} },
] as const;

type GoalSpec = {
  id: string;
  projectKey: typeof projectSpecs[number]['key'];
  title: string;
  description: string;
  ownerKeys: Array<typeof memberSpecs[number]['key']>;
  progress: number;
  size: 'xs' | 'small' | 'medium' | 'large' | 'xl';
  statusKey: typeof statusSpecs[number]['key'];
  cycleKey: 'annual' | 'q3' | 'q4' | 'next';
  categoryKeys: Array<typeof categoryTemplates[number]['key']>;
  startDate: string;
  dueDate: string;
  priority: string;
  teams: string[];
  effort: number;
  riskNote: string;
  alignedTo?: string;
};

const goalSpecs: GoalSpec[] = [
  { id: 'demo-goal-north-star', projectKey: 'strategy', title: '주간 활성 팀 1,000개 달성', description: '핵심 협업 루프를 개선하고 유료 전환으로 이어지는 활성 팀을 확대합니다.', ownerKeys: ['owner', 'pm'], progress: 62, size: 'xl', statusKey: 'doing', cycleKey: 'annual', categoryKeys: ['feature', 'research'], startDate: '2026-01-05', dueDate: '2026-12-18', priority: 'p_xl', teams: ['team_product', 'team_frontend', 'team_backend'], effort: 89, riskNote: '신규 유입보다 4주차 잔존율이 병목입니다.' },
  { id: 'demo-goal-enterprise', projectKey: 'strategy', title: '엔터프라이즈 보안 요건 충족', description: 'SSO, 감사 로그, 데이터 보존 정책을 제품 수준으로 정비합니다.', ownerKeys: ['owner', 'backend', 'devops'], progress: 38, size: 'xl', statusKey: 'risk', cycleKey: 'q4', categoryKeys: ['quality', 'tech'], startDate: '2026-07-01', dueDate: '2026-11-30', priority: 'p_xl', teams: ['team_backend', 'team_platform'], effort: 144, riskNote: '외부 보안 심사 일정이 아직 확정되지 않았습니다.' },
  { id: 'demo-goal-pricing', projectKey: 'strategy', title: '새 요금제 및 사용량 과금 검증', description: '고객군별 가격 민감도와 기능 패키지 구성을 검증합니다.', ownerKeys: ['pm', 'success'], progress: 100, size: 'large', statusKey: 'done', cycleKey: 'q3', categoryKeys: ['research'], startDate: '2026-06-10', dueDate: '2026-08-25', priority: 'p_large', teams: ['team_product'], effort: 34, riskNote: '완료: 12개 고객 인터뷰와 가격 실험을 반영했습니다.' },
  { id: 'demo-goal-board', projectKey: 'web', title: '대규모 보드 가상 스크롤 적용', description: '5,000개 목표가 있는 보드에서도 부드러운 탐색 경험을 제공합니다.', ownerKeys: ['frontend', 'backend'], progress: 76, size: 'large', statusKey: 'review', cycleKey: 'q3', categoryKeys: ['feature', 'quality'], startDate: '2026-07-15', dueDate: '2026-09-12', priority: 'p_xl', teams: ['team_frontend', 'team_backend'], effort: 55, riskNote: '드래그 중 높이 측정 오차를 추가 검증해야 합니다.', alignedTo: 'demo-goal-north-star' },
  { id: 'demo-goal-permission', projectKey: 'web', title: '프로젝트 단위 권한 모델', description: '조직 역할과 별개로 프로젝트별 보기·편집 권한을 제공합니다.', ownerKeys: ['backend', 'pm'], progress: 24, size: 'xl', statusKey: 'doing', cycleKey: 'q4', categoryKeys: ['feature', 'tech'], startDate: '2026-08-20', dueDate: '2026-11-14', priority: 'p_large', teams: ['team_backend', 'team_product'], effort: 89, riskNote: '기존 조직 권한과의 우선순위 규칙 합의가 필요합니다.', alignedTo: 'demo-goal-enterprise' },
  { id: 'demo-goal-a11y', projectKey: 'web', title: '핵심 화면 접근성 AA 개선', description: '키보드 탐색, 명도 대비, 스크린리더 레이블을 정비합니다.', ownerKeys: ['frontend', 'design', 'qa'], progress: 48, size: 'medium', statusKey: 'validate', cycleKey: 'q3', categoryKeys: ['quality'], startDate: '2026-08-01', dueDate: '2026-09-25', priority: 'p_medium', teams: ['team_frontend', 'team_design'], effort: 34, riskNote: '복합 팝오버 컴포넌트의 포커스 순서를 확인 중입니다.' },
  { id: 'demo-goal-realtime', projectKey: 'web', title: '실시간 공동 편집 기반 구축', description: '동일 목표를 여러 사용자가 수정할 때 충돌을 줄입니다.', ownerKeys: ['frontend', 'backend'], progress: 12, size: 'xl', statusKey: 'hold', cycleKey: 'next', categoryKeys: ['research', 'tech'], startDate: '2026-10-01', dueDate: '2027-02-26', priority: 'p_small', teams: ['team_frontend', 'team_backend'], effort: 144, riskNote: '현재 분기에는 권한 모델을 우선하여 보류했습니다.' },
  { id: 'demo-goal-ios', projectKey: 'mobile', title: 'iOS 베타 출시', description: '목표 조회, 체크인, 알림 중심의 첫 TestFlight 버전을 출시합니다.', ownerKeys: ['pm', 'frontend', 'design'], progress: 68, size: 'xl', statusKey: 'doing', cycleKey: 'q3', categoryKeys: ['feature'], startDate: '2026-06-20', dueDate: '2026-09-30', priority: 'p_xl', teams: ['team_frontend', 'team_design'], effort: 110, riskNote: '오프라인 동기화의 충돌 처리가 일정 위험입니다.', alignedTo: 'demo-goal-north-star' },
  { id: 'demo-goal-push', projectKey: 'mobile', title: '개인화 푸시 알림', description: '마감 임박, 멘션, 체크인 리마인더를 사용자별로 제공합니다.', ownerKeys: ['frontend', 'backend'], progress: 42, size: 'large', statusKey: 'review', cycleKey: 'q4', categoryKeys: ['feature', 'operation'], startDate: '2026-08-18', dueDate: '2026-10-20', priority: 'p_large', teams: ['team_frontend', 'team_backend'], effort: 55, riskNote: '플랫폼별 알림 권한 전환율을 측정해야 합니다.' },
  { id: 'demo-goal-android', projectKey: 'mobile', title: 'Android 기술 검증', description: '공유 UI 전략과 네이티브 구현 비용을 비교합니다.', ownerKeys: ['frontend', 'qa'], progress: 100, size: 'medium', statusKey: 'done', cycleKey: 'q3', categoryKeys: ['research'], startDate: '2026-07-01', dueDate: '2026-08-10', priority: 'p_medium', teams: ['team_frontend'], effort: 21, riskNote: 'Kotlin Multiplatform을 우선 후보로 선정했습니다.' },
  { id: 'demo-goal-summary', projectKey: 'ai', title: '주간 목표 요약 코파일럿', description: '변경 이력과 체크인을 바탕으로 주간 보고 초안을 만듭니다.', ownerKeys: ['ai', 'pm', 'backend'], progress: 81, size: 'large', statusKey: 'validate', cycleKey: 'q3', categoryKeys: ['feature', 'research'], startDate: '2026-07-10', dueDate: '2026-09-15', priority: 'p_xl', teams: ['team_ai', 'team_backend', 'team_product'], effort: 55, riskNote: '요약의 사실성 평가 기준을 고객 검증 중입니다.', alignedTo: 'demo-goal-north-star' },
  { id: 'demo-goal-risk-ai', projectKey: 'ai', title: '일정 위험 조기 감지 모델', description: '지연 신호와 의존성을 분석해 위험 목표를 추천합니다.', ownerKeys: ['ai', 'backend'], progress: 36, size: 'xl', statusKey: 'risk', cycleKey: 'q4', categoryKeys: ['research', 'feature'], startDate: '2026-08-01', dueDate: '2026-12-05', priority: 'p_large', teams: ['team_ai', 'team_backend'], effort: 89, riskNote: '학습용 지연 사례 데이터가 아직 부족합니다.' },
  { id: 'demo-goal-ai-guardrail', projectKey: 'ai', title: 'AI 응답 안전성 평가 체계', description: '프롬프트 회귀, 개인정보 노출, 환각을 자동 평가합니다.', ownerKeys: ['ai', 'qa'], progress: 54, size: 'large', statusKey: 'doing', cycleKey: 'q4', categoryKeys: ['quality', 'research'], startDate: '2026-08-12', dueDate: '2026-11-08', priority: 'p_large', teams: ['team_ai', 'team_platform'], effort: 55, riskNote: '한국어 업무 문맥 평가셋을 확장해야 합니다.' },
  { id: 'demo-goal-ci', projectKey: 'dx', title: 'CI 평균 시간 12분에서 5분으로 단축', description: '캐시, 테스트 샤딩, 변경 영향 기반 실행을 적용합니다.', ownerKeys: ['devops', 'qa'], progress: 73, size: 'large', statusKey: 'doing', cycleKey: 'q3', categoryKeys: ['quality', 'tech'], startDate: '2026-07-05', dueDate: '2026-09-20', priority: 'p_large', teams: ['team_platform'], effort: 55, riskNote: 'E2E 테스트의 병렬 격리 비용이 예상보다 큽니다.' },
  { id: 'demo-goal-observability', projectKey: 'dx', title: '서비스 관측성 표준화', description: '로그, 메트릭, 트레이스와 SLO 대시보드를 통합합니다.', ownerKeys: ['devops', 'backend'], progress: 57, size: 'large', statusKey: 'deploy', cycleKey: 'q3', categoryKeys: ['operation', 'quality'], startDate: '2026-06-15', dueDate: '2026-09-10', priority: 'p_large', teams: ['team_platform', 'team_backend'], effort: 55, riskNote: '운영 리전의 에이전트 배포만 남았습니다.' },
  { id: 'demo-goal-local-dev', projectKey: 'dx', title: '신규 개발자 환경 30분 내 구성', description: '컨테이너 기반 로컬 DB와 원클릭 초기화를 제공합니다.', ownerKeys: ['devops', 'frontend'], progress: 100, size: 'medium', statusKey: 'done', cycleKey: 'q3', categoryKeys: ['tech', 'quality'], startDate: '2026-07-20', dueDate: '2026-08-28', priority: 'p_medium', teams: ['team_platform', 'team_frontend'], effort: 34, riskNote: '완료: macOS와 Linux 온보딩 문서를 검증했습니다.' },
  { id: 'demo-goal-onboarding', projectKey: 'success', title: '신규 고객 7일 내 첫 가치 경험', description: '샘플 템플릿과 가이드 투어로 첫 목표 운영 시간을 단축합니다.', ownerKeys: ['success', 'design', 'pm'], progress: 64, size: 'large', statusKey: 'validate', cycleKey: 'q3', categoryKeys: ['feature', 'operation'], startDate: '2026-07-15', dueDate: '2026-09-30', priority: 'p_xl', teams: ['team_product', 'team_design'], effort: 55, riskNote: '산업별 템플릿의 적합도 편차가 큽니다.', alignedTo: 'demo-goal-north-star' },
  { id: 'demo-goal-feedback', projectKey: 'success', title: '고객 피드백 48시간 내 분류', description: '지원 채널의 의견을 제품 영역과 긴급도로 자동 분류합니다.', ownerKeys: ['success', 'ai'], progress: 29, size: 'medium', statusKey: 'doing', cycleKey: 'q4', categoryKeys: ['operation', 'research'], startDate: '2026-08-25', dueDate: '2026-10-31', priority: 'p_medium', teams: ['team_product', 'team_ai'], effort: 34, riskNote: '채널별 개인정보 마스킹 정책을 정해야 합니다.' },
  { id: 'demo-goal-sla', projectKey: 'success', title: '지원 SLA 95% 달성', description: '우선순위별 응답 체계와 주간 운영 리뷰를 정착시킵니다.', ownerKeys: ['success', 'qa'], progress: 91, size: 'medium', statusKey: 'deploy', cycleKey: 'q3', categoryKeys: ['operation', 'quality'], startDate: '2026-06-01', dueDate: '2026-09-05', priority: 'p_large', teams: ['team_product'], effort: 21, riskNote: '주말 긴급 대응 로테이션만 최종 합의가 필요합니다.' },
];

type SupplementalGoalSeed = Pick<GoalSpec, 'title' | 'description' | 'ownerKeys' | 'categoryKeys' | 'teams' | 'riskNote'> & {
  slug: string;
};

const supplementalGoalSeeds = {
  strategy: [
    { slug: 'roadmap-rhythm', title: '분기 로드맵 운영 체계 정착', description: '전사 우선순위와 팀별 실행 항목을 매월 재조정하는 운영 리듬을 만듭니다.', ownerKeys: ['owner', 'pm'], categoryKeys: ['operation', 'growth'], teams: ['team_product'], riskNote: '팀별 의존성 갱신 주기가 달라 월간 리뷰 전에 정합성 확인이 필요합니다.' },
    { slug: 'metric-quality', title: '핵심 제품 지표 신뢰도 99% 확보', description: '활성 팀, 유지율, 기능 채택률의 정의와 집계 파이프라인을 단일화합니다.', ownerKeys: ['data', 'pm'], categoryKeys: ['data', 'quality'], teams: ['team_data', 'team_product'], riskNote: '과거 이벤트 스키마가 혼재되어 소급 집계 오차를 먼저 제거해야 합니다.' },
    { slug: 'design-partners', title: '디자인 파트너 고객 20개사 운영', description: '전략 고객과 격주로 신기능을 검증하고 학습 내용을 로드맵에 반영합니다.', ownerKeys: ['research', 'success', 'pm'], categoryKeys: ['research', 'growth'], teams: ['team_product', 'team_success'], riskNote: '고객군별 요구가 분산되지 않도록 공통 검증 질문을 유지해야 합니다.' },
    { slug: 'analytics-governance', title: '제품 분석 데이터 거버넌스 수립', description: '이벤트 명명, 소유자, 보존 기간과 개인정보 처리 기준을 문서화합니다.', ownerKeys: ['data', 'security'], categoryKeys: ['data', 'security'], teams: ['team_data', 'team_security'], riskNote: '개인정보 최소 수집 원칙과 분석 요구 사이의 합의가 남아 있습니다.' },
    { slug: 'product-council', title: '제품 의사결정 위원회 운영', description: '대규모 투자와 중단 결정을 위한 근거, 기록, 후속 조치 체계를 만듭니다.', ownerKeys: ['owner', 'pm', 'research'], categoryKeys: ['operation', 'research'], teams: ['team_product'], riskNote: '결정권자 부재 시 승인 지연을 막을 대리 규칙이 필요합니다.' },
    { slug: 'global-launch', title: '일본 시장 베타 출시 준비', description: '현지화, 결제, 개인정보 정책과 초기 고객 지원 체계를 준비합니다.', ownerKeys: ['pm', 'success', 'security'], categoryKeys: ['growth', 'security'], teams: ['team_product', 'team_success', 'team_security'], riskNote: '현지 개인정보 고지 문구에 대한 법률 검토 일정이 촉박합니다.' },
    { slug: 'partner-api', title: '파트너 API 생태계 정책 설계', description: '공개 API 범위, 인증, 사용량 제한과 파트너 등급을 정의합니다.', ownerKeys: ['backend', 'security', 'pm'], categoryKeys: ['feature', 'security'], teams: ['team_backend', 'team_security'], riskNote: '초기 파트너별 예외 요구가 표준 API 범위를 흔들 수 있습니다.' },
    { slug: 'churn-playbook', title: '이탈 위험 고객 대응 플레이북', description: '사용 감소 신호를 정의하고 제품·고객성공 팀의 공동 대응 흐름을 구축합니다.', ownerKeys: ['success', 'data', 'pm'], categoryKeys: ['data', 'operation'], teams: ['team_success', 'team_data'], riskNote: '건강도 점수의 오탐이 높아 수동 검토 단계를 유지해야 합니다.' },
    { slug: 'hiring-plan', title: '2027 엔지니어링 채용 계획 확정', description: '제품 투자 영역에 맞춰 직군별 채용 순서와 온보딩 수용력을 계산합니다.', ownerKeys: ['owner', 'devops'], categoryKeys: ['operation'], teams: ['team_platform', 'team_product'], riskNote: '시니어 백엔드 채용 리드타임을 계획에 충분히 반영해야 합니다.' },
    { slug: 'fy27-thesis', title: '2027 제품 전략 가설 검증', description: 'AI 협업, 엔터프라이즈 확장, 글로벌 진출 세 축의 투자 가설을 검증합니다.', ownerKeys: ['owner', 'research', 'pm'], categoryKeys: ['research', 'growth'], teams: ['team_product', 'team_ai'], riskNote: '시장 데이터와 기존 고객 수요가 충돌하는 지점을 추가 인터뷰로 확인 중입니다.' },
  ],
  web: [
    { slug: 'command-palette', title: '통합 명령 팔레트 출시', description: '키보드만으로 목표 생성, 검색, 프로젝트 이동을 빠르게 수행합니다.', ownerKeys: ['frontend', 'design'], categoryKeys: ['feature', 'quality'], teams: ['team_frontend', 'team_design'], riskNote: '한글 조합 입력 중 단축키 충돌을 브라우저별로 검증해야 합니다.' },
    { slug: 'bulk-edit', title: '목표 일괄 편집 기능', description: '여러 목표의 담당자, 상태, 사이클과 마감일을 한 번에 변경합니다.', ownerKeys: ['frontend', 'backend', 'qa'], categoryKeys: ['feature'], teams: ['team_frontend', 'team_backend'], riskNote: '부분 실패 시 롤백과 사용자 피드백 방식을 확정해야 합니다.' },
    { slug: 'saved-filters', title: '고급 필터와 저장된 검색', description: '다중 조건 필터를 팀과 공유하고 자주 쓰는 탐색을 빠르게 재사용합니다.', ownerKeys: ['frontend', 'pm'], categoryKeys: ['feature', 'growth'], teams: ['team_frontend', 'team_product'], riskNote: '기존 저장 뷰와 필터 스키마를 하나로 합치는 마이그레이션이 필요합니다.' },
    { slug: 'dnd-a11y', title: '드래그 앤 드롭 키보드 조작 지원', description: '보드와 카드 순서를 키보드 및 스크린리더로도 변경할 수 있게 합니다.', ownerKeys: ['frontend', 'design', 'qa'], categoryKeys: ['quality'], teams: ['team_frontend', 'team_design'], riskNote: '정렬 결과를 음성으로 전달하는 문구의 사용성 검증이 남았습니다.' },
    { slug: 'notification-center', title: '실시간 알림 센터 개편', description: '멘션, 상태 변경, 마감 임박 알림을 유형별로 묶어 제공합니다.', ownerKeys: ['frontend', 'backend'], categoryKeys: ['feature', 'operation'], teams: ['team_frontend', 'team_backend'], riskNote: '대량 알림 발생 시 읽음 처리 동기화 부하를 확인해야 합니다.' },
    { slug: 'audit-search', title: '감사 로그 검색과 CSV 내보내기', description: '사용자, 기간, 이벤트별 감사 이력을 조회하고 보안 검토 자료로 내보냅니다.', ownerKeys: ['backend', 'security'], categoryKeys: ['security', 'feature'], teams: ['team_backend', 'team_security'], riskNote: '내보내기 파일의 개인정보 마스킹 기준을 보안팀과 조율 중입니다.' },
    { slug: 'web-vitals', title: '핵심 화면 LCP 1.8초 달성', description: '초기 번들, 데이터 페칭과 렌더링 경로를 최적화해 체감 속도를 개선합니다.', ownerKeys: ['frontend', 'devops'], categoryKeys: ['quality', 'tech'], teams: ['team_frontend', 'team_platform'], riskNote: '대형 프로젝트의 카드 데이터 양이 성능 편차의 주원인입니다.' },
    { slug: 'design-tokens', title: '디자인 토큰 2.0 전환', description: '색상, 간격, 타이포그래피를 의미 기반 토큰으로 재정비합니다.', ownerKeys: ['design', 'frontend'], categoryKeys: ['tech', 'quality'], teams: ['team_design', 'team_frontend'], riskNote: '레거시 컴포넌트의 직접 색상 지정이 예상보다 많이 남아 있습니다.' },
    { slug: 'rate-limit-ui', title: 'API 사용량 및 제한 화면', description: '워크스페이스별 API 호출량과 제한 도달 예상 시점을 시각화합니다.', ownerKeys: ['backend', 'frontend', 'data'], categoryKeys: ['feature', 'data'], teams: ['team_backend', 'team_frontend', 'team_data'], riskNote: '분 단위 집계 비용과 실시간성 사이의 절충이 필요합니다.' },
    { slug: 'template-gallery', title: '업무 템플릿 갤러리', description: '개발, 마케팅, 고객 성공 시나리오별 프로젝트 템플릿을 제공합니다.', ownerKeys: ['pm', 'design', 'success'], categoryKeys: ['feature', 'growth'], teams: ['team_product', 'team_design'], riskNote: '템플릿 품질 기준과 게시 승인 흐름을 먼저 정해야 합니다.' },
  ],
  mobile: [
    { slug: 'android-alpha', title: 'Android 알파 버전 배포', description: '핵심 목표 조회와 체크인을 포함한 사내 알파 버전을 배포합니다.', ownerKeys: ['mobile', 'qa', 'design'], categoryKeys: ['feature', 'quality'], teams: ['team_mobile', 'team_design'], riskNote: '저사양 단말의 목록 스크롤 성능이 목표치에 못 미칩니다.' },
    { slug: 'offline-read', title: '오프라인 목표 조회 지원', description: '네트워크가 불안정해도 최근 프로젝트와 목표를 안전하게 확인합니다.', ownerKeys: ['mobile', 'backend'], categoryKeys: ['feature', 'tech'], teams: ['team_mobile', 'team_backend'], riskNote: '캐시 만료와 권한 회수 시점의 보안 정책이 필요합니다.' },
    { slug: 'biometric-login', title: '생체 인증 재로그인', description: 'Face ID와 지문으로 세션 잠금을 빠르게 해제합니다.', ownerKeys: ['mobile', 'security'], categoryKeys: ['security', 'feature'], teams: ['team_mobile', 'team_security'], riskNote: '기기 분실 시 토큰 폐기와 복구 흐름을 함께 검증해야 합니다.' },
    { slug: 'deep-links', title: '알림 딥링크 라우팅', description: '푸시 알림에서 정확한 목표, 댓글, 프로젝트 화면으로 이동합니다.', ownerKeys: ['mobile', 'backend'], categoryKeys: ['feature', 'quality'], teams: ['team_mobile', 'team_backend'], riskNote: '권한이 사라진 대상 링크의 예외 화면이 아직 통일되지 않았습니다.' },
    { slug: 'tablet-layout', title: '태블릿 분할 화면 최적화', description: 'iPad와 폴더블 기기에서 목록과 상세를 동시에 탐색합니다.', ownerKeys: ['mobile', 'design'], categoryKeys: ['feature'], teams: ['team_mobile', 'team_design'], riskNote: '동적 글자 크기에서 두 패널의 최소 너비가 충돌합니다.' },
    { slug: 'crash-free', title: '크래시 없는 세션 99.9% 달성', description: '충돌 수집, 심볼 업로드와 릴리스별 회귀 감시를 정착시킵니다.', ownerKeys: ['mobile', 'qa', 'devops'], categoryKeys: ['quality', 'operation'], teams: ['team_mobile', 'team_platform'], riskNote: '백그라운드 동기화 충돌의 재현 조건을 좁히는 중입니다.' },
    { slug: 'store-review', title: '앱스토어 심사 체크리스트 자동화', description: '권한 문구, 개인정보 라벨과 빌드 설정을 배포 전에 자동 검사합니다.', ownerKeys: ['mobile', 'security', 'qa'], categoryKeys: ['operation', 'security'], teams: ['team_mobile', 'team_security'], riskNote: '스토어 정책 변경을 체크리스트에 반영하는 소유자가 필요합니다.' },
    { slug: 'home-widget', title: '오늘의 목표 홈 위젯', description: '마감 임박 목표와 개인 체크인 항목을 홈 화면에서 확인합니다.', ownerKeys: ['mobile', 'design', 'pm'], categoryKeys: ['feature', 'growth'], teams: ['team_mobile', 'team_design'], riskNote: '위젯 갱신 제한 안에서 최신성을 유지하는 전략을 실험 중입니다.' },
    { slug: 'mobile-analytics', title: '모바일 행동 분석 체계 구축', description: '온보딩, 알림, 체크인 퍼널을 플랫폼별로 비교할 수 있게 합니다.', ownerKeys: ['data', 'mobile', 'pm'], categoryKeys: ['data', 'growth'], teams: ['team_data', 'team_mobile'], riskNote: 'iOS 추적 동의 전후 이벤트 정의를 분리해야 합니다.' },
    { slug: 'beta-community', title: '베타 사용자 커뮤니티 300명 모집', description: '직군별 베타 그룹을 구성하고 매주 사용성 피드백을 수집합니다.', ownerKeys: ['success', 'research', 'mobile'], categoryKeys: ['research', 'growth'], teams: ['team_success', 'team_mobile'], riskNote: '활성 참여자를 유지할 보상과 피드백 반영 주기를 정해야 합니다.' },
  ],
  ai: [
    { slug: 'goal-drafting', title: 'AI 목표 초안 작성 도우미', description: '간단한 문제 설명에서 측정 가능한 목표와 하위 목표 초안을 제안합니다.', ownerKeys: ['ai', 'pm', 'research'], categoryKeys: ['feature', 'research'], teams: ['team_ai', 'team_product'], riskNote: '과도하게 일반적인 제안 비율을 낮추기 위한 문맥 입력이 필요합니다.' },
    { slug: 'meeting-actions', title: '회의록 액션 아이템 자동 추출', description: '회의 메모에서 담당자, 기한, 의사결정을 구조화해 목표 후보로 만듭니다.', ownerKeys: ['ai', 'backend'], categoryKeys: ['feature', 'data'], teams: ['team_ai', 'team_backend'], riskNote: '동명이인 담당자 연결의 정확도가 아직 목표치보다 낮습니다.' },
    { slug: 'semantic-search', title: '조직 목표 의미 검색', description: '표현이 달라도 관련 목표, 결정, 댓글을 의미 기반으로 찾아줍니다.', ownerKeys: ['ai', 'backend', 'data'], categoryKeys: ['feature', 'research'], teams: ['team_ai', 'team_backend', 'team_data'], riskNote: '조직별 용어 차이에 따른 검색 품질 편차를 측정해야 합니다.' },
    { slug: 'rag-citations', title: 'AI 답변 근거 링크 제공', description: '요약과 추천마다 참조한 체크인, 댓글, 변경 이력을 표시합니다.', ownerKeys: ['ai', 'frontend', 'qa'], categoryKeys: ['quality', 'feature'], teams: ['team_ai', 'team_frontend'], riskNote: '삭제된 원문과 생성된 답변 사이의 참조 무결성 처리가 남았습니다.' },
    { slug: 'model-cost', title: '모델 비용 관측 대시보드', description: '기능, 조직, 모델별 토큰 사용량과 단위 비용을 추적합니다.', ownerKeys: ['ai', 'data', 'devops'], categoryKeys: ['data', 'operation'], teams: ['team_ai', 'team_data', 'team_platform'], riskNote: '캐시 적중 요청의 비용 귀속 규칙을 정해야 합니다.' },
    { slug: 'prompt-registry', title: '프롬프트 버전 관리 체계', description: '프롬프트 변경, 평가 결과와 롤백 이력을 제품 코드와 함께 관리합니다.', ownerKeys: ['ai', 'devops', 'qa'], categoryKeys: ['tech', 'quality'], teams: ['team_ai', 'team_platform'], riskNote: '실험용 프롬프트와 운영 버전의 승격 규칙을 합의 중입니다.' },
    { slug: 'pii-redaction', title: 'AI 입력 개인정보 자동 마스킹', description: '모델 호출 전에 이메일, 전화번호와 고객 식별자를 탐지해 제거합니다.', ownerKeys: ['security', 'ai', 'backend'], categoryKeys: ['security', 'quality'], teams: ['team_security', 'team_ai'], riskNote: '한국어 주소와 사내 식별자 유형의 탐지율을 높여야 합니다.' },
    { slug: 'model-routing', title: '업무별 멀티 모델 라우팅', description: '품질, 지연, 비용 요구에 따라 적합한 모델을 자동 선택합니다.', ownerKeys: ['ai', 'backend', 'data'], categoryKeys: ['tech', 'data'], teams: ['team_ai', 'team_backend'], riskNote: '공급자 장애 시 품질 저하 한계와 전환 기준이 필요합니다.' },
    { slug: 'feedback-loop', title: 'AI 답변 피드백 학습 루프', description: '사용자 평가와 편집 내용을 품질 개선 데이터로 축적합니다.', ownerKeys: ['research', 'ai', 'data'], categoryKeys: ['research', 'data'], teams: ['team_ai', 'team_data'], riskNote: '개인별 문체 선호와 객관적 정확성 신호를 분리해야 합니다.' },
    { slug: 'release-gate', title: 'AI 기능 자동 릴리스 게이트', description: '정확성, 안전성, 지연, 비용 기준을 통과한 모델만 운영에 승격합니다.', ownerKeys: ['qa', 'ai', 'devops'], categoryKeys: ['quality', 'operation'], teams: ['team_ai', 'team_platform'], riskNote: '평가셋 과적합을 막기 위한 숨은 테스트 세트가 부족합니다.' },
  ],
  dx: [
    { slug: 'preview-env', title: 'PR별 프리뷰 환경 자동 생성', description: '프론트엔드와 API 변경을 리뷰 전용 URL에서 함께 검증합니다.', ownerKeys: ['devops', 'frontend', 'backend'], categoryKeys: ['feature', 'operation'], teams: ['team_platform', 'team_frontend'], riskNote: 'DB 스키마 변경이 포함된 PR의 격리 비용이 높습니다.' },
    { slug: 'flaky-tests', title: '불안정 테스트 비율 1% 미만', description: '실패 이력과 격리 실행을 바탕으로 flaky 테스트를 자동 추적합니다.', ownerKeys: ['qa', 'devops'], categoryKeys: ['quality', 'tech'], teams: ['team_platform'], riskNote: '외부 API 의존 테스트의 실패 원인 분류가 아직 자동화되지 않았습니다.' },
    { slug: 'dependency-bot', title: '의존성 업데이트 자동화', description: '보안·패치 버전 업데이트를 위험도에 따라 생성하고 검증합니다.', ownerKeys: ['security', 'devops'], categoryKeys: ['security', 'operation'], teams: ['team_security', 'team_platform'], riskNote: '메이저 버전은 자동 병합하지 않고 담당 팀 승인이 필요합니다.' },
    { slug: 'db-snapshots', title: '개발용 익명 DB 스냅샷 제공', description: '민감정보가 제거된 현실적인 데이터로 로컬 디버깅 품질을 높입니다.', ownerKeys: ['backend', 'security', 'devops'], categoryKeys: ['data', 'security'], teams: ['team_backend', 'team_security'], riskNote: '자유 형식 메모에 포함된 개인정보 탐지 범위를 확대해야 합니다.' },
    { slug: 'incident-drills', title: '분기 장애 대응 훈련 정례화', description: '실제 장애 시나리오로 탐지, 커뮤니케이션과 복구 절차를 검증합니다.', ownerKeys: ['devops', 'backend', 'support'], categoryKeys: ['operation', 'quality'], teams: ['team_platform', 'team_backend'], riskNote: '업무 시간 외 참여 부담을 낮출 훈련 운영 방식이 필요합니다.' },
    { slug: 'feature-flags', title: '기능 플래그 수명주기 관리', description: '생성, 점진 배포, 만료와 제거를 하나의 흐름으로 관리합니다.', ownerKeys: ['devops', 'frontend', 'backend'], categoryKeys: ['tech', 'operation'], teams: ['team_platform', 'team_frontend'], riskNote: '장기 방치된 플래그의 실제 사용자 영향을 분석 중입니다.' },
    { slug: 'build-graph', title: '변경 영향 기반 빌드 그래프', description: '변경된 패키지와 의존성만 빌드·테스트해 피드백 시간을 줄입니다.', ownerKeys: ['devops', 'frontend'], categoryKeys: ['tech', 'quality'], teams: ['team_platform', 'team_frontend'], riskNote: '동적 import 경로가 그래프 분석에서 누락되는 사례가 있습니다.' },
    { slug: 'secret-rotation', title: '운영 비밀정보 자동 순환', description: 'DB, 외부 API와 서명 키를 무중단으로 교체하는 절차를 구축합니다.', ownerKeys: ['security', 'devops', 'backend'], categoryKeys: ['security', 'operation'], teams: ['team_security', 'team_platform'], riskNote: '일부 레거시 워커가 이중 키 유효 기간을 지원하지 않습니다.' },
    { slug: 'load-test', title: '정기 부하 테스트 기준선 구축', description: '주요 API와 대형 보드 시나리오의 성능 회귀를 매주 측정합니다.', ownerKeys: ['qa', 'devops', 'backend'], categoryKeys: ['quality', 'data'], teams: ['team_platform', 'team_backend'], riskNote: '운영 트래픽과 유사한 목표 분포를 테스트 데이터에 반영해야 합니다.' },
    { slug: 'docs-portal', title: '개발자 문서 포털 통합', description: '아키텍처, API, 운영 런북과 온보딩 문서를 한곳에서 검색합니다.', ownerKeys: ['devops', 'backend', 'support'], categoryKeys: ['operation', 'tech'], teams: ['team_platform'], riskNote: '문서 최신성을 코드 소유자 책임과 연결하는 규칙이 필요합니다.' },
  ],
  success: [
    { slug: 'industry-templates', title: '산업별 온보딩 템플릿 12종', description: 'SaaS, 제조, 전문서비스 고객이 바로 시작할 수 있는 예시를 제공합니다.', ownerKeys: ['success', 'design', 'research'], categoryKeys: ['feature', 'growth'], teams: ['team_success', 'team_design'], riskNote: '산업별 용어가 실제 고객 업무와 맞는지 추가 검수가 필요합니다.' },
    { slug: 'health-score', title: '고객 건강도 점수 자동화', description: '활성도, 목표 달성, 지원 이력을 결합해 위험 고객을 조기에 찾습니다.', ownerKeys: ['data', 'success', 'pm'], categoryKeys: ['data', 'operation'], teams: ['team_data', 'team_success'], riskNote: '소규모 고객의 낮은 사용량을 위험으로 오인하는 편향이 있습니다.' },
    { slug: 'qbr-report', title: '분기 비즈니스 리뷰 자동 리포트', description: '성과, 도입률, 주요 이슈와 다음 분기 제안을 자동 구성합니다.', ownerKeys: ['success', 'ai', 'data'], categoryKeys: ['feature', 'data'], teams: ['team_success', 'team_ai'], riskNote: '고객별 계약 목표를 제품 지표와 연결하는 매핑이 필요합니다.' },
    { slug: 'knowledge-base', title: '고객지원 지식베이스 개편', description: '검색 실패 질문을 분석해 도움말 구조와 콘텐츠를 재정비합니다.', ownerKeys: ['support', 'success', 'research'], categoryKeys: ['operation', 'quality'], teams: ['team_success'], riskNote: '오래된 스크린샷과 제품 용어를 일괄 갱신해야 합니다.' },
    { slug: 'expansion-playbook', title: '조직 확장 세일즈 플레이북', description: '활성 팀에서 다른 부서로 확장되는 신호와 제안 흐름을 표준화합니다.', ownerKeys: ['success', 'pm', 'data'], categoryKeys: ['growth', 'data'], teams: ['team_success', 'team_product'], riskNote: '확장 제안이 과도한 영업 접촉으로 느껴지지 않도록 기준을 조정 중입니다.' },
    { slug: 'customer-council', title: '고객 자문단 월간 운영', description: '제품 방향과 베타 기능을 검토하는 15개 고객 자문단을 운영합니다.', ownerKeys: ['research', 'success', 'owner'], categoryKeys: ['research', 'growth'], teams: ['team_success', 'team_product'], riskNote: '특정 산업 의견이 전체 로드맵을 과도하게 대표하지 않게 해야 합니다.' },
    { slug: 'renewal-risk', title: '갱신 위험 90일 사전 대응', description: '계약 만료 90일 전 제품·지원·관계 신호를 종합해 대응을 시작합니다.', ownerKeys: ['success', 'data', 'support'], categoryKeys: ['operation', 'data'], teams: ['team_success', 'team_data'], riskNote: '계약 데이터 동기화 지연으로 일부 고객의 알림이 늦게 생성됩니다.' },
    { slug: 'csat-loop', title: '지원 만족도 4.7점 달성', description: '문의 유형별 만족도와 재문의율을 분석해 지원 품질을 개선합니다.', ownerKeys: ['support', 'success', 'qa'], categoryKeys: ['quality', 'operation'], teams: ['team_success'], riskNote: '응답률이 낮은 고객군의 의견을 보완할 인터뷰가 필요합니다.' },
    { slug: 'partner-training', title: '파트너 인증 교육 프로그램', description: '구축 파트너가 고객 온보딩과 운영을 독립적으로 지원하게 합니다.', ownerKeys: ['success', 'support', 'pm'], categoryKeys: ['growth', 'operation'], teams: ['team_success', 'team_product'], riskNote: '실습용 샌드박스 계정과 평가 기준 준비가 늦어지고 있습니다.' },
    { slug: 'incident-comms', title: '고객 장애 커뮤니케이션 표준화', description: '영향 공지, 진행 업데이트와 사후 보고의 시간·문구 기준을 만듭니다.', ownerKeys: ['support', 'devops', 'success'], categoryKeys: ['operation', 'quality'], teams: ['team_success', 'team_platform'], riskNote: '기술 상태와 고객 영향 수준을 일관되게 번역할 기준이 필요합니다.' },
  ],
} satisfies Record<GoalSpec['projectKey'], SupplementalGoalSeed[]>;

const supplementalStatuses: GoalSpec['statusKey'][] = ['doing', 'review', 'validate', 'risk', 'deploy', 'todo', 'doing', 'hold', 'done', 'review'];
const supplementalProgress = [44, 72, 83, 39, 92, 12, 58, 21, 100, 67];
const supplementalSizes: GoalSpec['size'][] = ['large', 'medium', 'large', 'xl', 'medium', 'small', 'large', 'medium', 'medium', 'large'];
const supplementalCycles: GoalSpec['cycleKey'][] = ['q3', 'q3', 'q3', 'q4', 'q3', 'q4', 'q4', 'next', 'q3', 'q4'];
const supplementalStarts = ['2026-07-21', '2026-07-28', '2026-08-03', '2026-08-10', '2026-06-24', '2026-09-01', '2026-08-17', '2026-10-05', '2026-06-02', '2026-08-24'];
const supplementalDueDates = ['2026-09-09', '2026-09-16', '2026-09-23', '2026-11-13', '2026-09-05', '2026-12-04', '2026-10-23', '2027-02-12', '2026-08-27', '2026-11-27'];
const supplementalPriorities = ['p_xl', 'p_large', 'p_large', 'p_xl', 'p_large', 'p_small', 'p_medium', 'p_small', 'p_medium', 'p_large'];
const supplementalEfforts = [55, 34, 55, 89, 34, 21, 55, 34, 21, 55];
const alignmentRoots: Record<GoalSpec['projectKey'], string> = {
  strategy: 'demo-goal-north-star',
  web: 'demo-goal-board',
  mobile: 'demo-goal-ios',
  ai: 'demo-goal-summary',
  dx: 'demo-goal-ci',
  success: 'demo-goal-onboarding',
};

goalSpecs.push(...projectSpecs.flatMap((project) =>
  supplementalGoalSeeds[project.key].map((seed, index): GoalSpec => ({
    id: `demo-goal-${project.key}-portfolio-${index + 1}`,
    projectKey: project.key,
    title: seed.title,
    description: seed.description,
    ownerKeys: seed.ownerKeys,
    progress: supplementalProgress[index],
    size: supplementalSizes[index],
    statusKey: supplementalStatuses[index],
    cycleKey: supplementalCycles[index],
    categoryKeys: seed.categoryKeys,
    startDate: supplementalStarts[index],
    dueDate: supplementalDueDates[index],
    priority: supplementalPriorities[index],
    teams: seed.teams,
    effort: supplementalEfforts[index],
    riskNote: seed.riskNote,
    alignedTo: alignmentRoots[project.key],
  })),
));

const memberName = (members: Map<string, { id: string; name: string }>, key: string) => {
  const member = members.get(key);
  if (!member) throw new Error(`Unknown member: ${key}`);
  return member;
};

const json = (value: unknown) => value as Prisma.InputJsonValue;

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const members = new Map<string, { id: string; name: string }>();
    for (const spec of memberSpecs) {
      const user = await tx.user.upsert({
        where: { email: spec.email },
        update: {
          name: spec.name,
          isEmailVerified: true,
          emailVerificationCode: null,
          emailVerificationCodeExpiresAt: null,
          ...(spec.key === 'owner' ? { passwordHash } : {}),
        },
        create: {
          id: `demo-user-${spec.key}`,
          email: spec.email,
          name: spec.name,
          passwordHash: spec.key === 'owner' ? passwordHash : null,
          isEmailVerified: true,
        },
      });
      members.set(spec.key, { id: user.id, name: user.name });
    }

    const organization = await tx.organization.upsert({
      where: { slug: ORG_SLUG },
      update: { name: 'Mokpyo Labs' },
      create: { id: 'demo-org-mokpyo-labs', name: 'Mokpyo Labs', slug: ORG_SLUG },
    });

    for (const spec of memberSpecs) {
      const user = memberName(members, spec.key);
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
        update: { role: spec.role },
        create: { organizationId: organization.id, userId: user.id, role: spec.role },
      });
    }

    const statuses = new Map<string, { id: string; kind: string }>();
    for (const spec of statusSpecs) {
      const status = await tx.statusLabel.upsert({
        where: { organizationId_name: { organizationId: organization.id, name: spec.name } },
        update: { color: spec.color, kind: spec.kind, order: spec.order, isSystem: spec.isSystem },
        create: { id: `demo-status-${spec.key}`, organizationId: organization.id, name: spec.name, color: spec.color, kind: spec.kind, order: spec.order, isSystem: spec.isSystem },
      });
      statuses.set(spec.key, { id: status.id, kind: status.kind });
    }

    const cycleSpecs = [
      { key: 'annual', id: 'demo-cycle-annual', name: '2026 연간', type: 'annual', startDate: '2026-01-01', endDate: '2026-12-31' },
      { key: 'q3', id: 'demo-cycle-q3', name: '2026 Q3', type: 'quarter', startDate: '2026-07-01', endDate: '2026-09-30' },
      { key: 'q4', id: 'demo-cycle-q4', name: '2026 Q4', type: 'quarter', startDate: '2026-10-01', endDate: '2026-12-31' },
      { key: 'next', id: 'demo-cycle-next', name: '2027 Q1', type: 'quarter', startDate: '2027-01-01', endDate: '2027-03-31' },
    ] as const;
    const cycles = new Map<string, string>();
    for (const spec of cycleSpecs) {
      const cycle = await tx.cycle.upsert({
        where: { id: spec.id },
        update: { name: spec.name, type: spec.type, startDate: spec.startDate, endDate: spec.endDate },
        create: { id: spec.id, organizationId: organization.id, name: spec.name, type: spec.type, startDate: spec.startDate, endDate: spec.endDate },
      });
      cycles.set(spec.key, cycle.id);
    }

    const projects = new Map<string, string>();
    for (const spec of projectSpecs) {
      const parentId = spec.parentKey ? projects.get(spec.parentKey) : null;
      const project = await tx.project.upsert({
        where: { id: spec.id },
        update: { name: spec.name, description: spec.description, dashboardTitle: spec.name, dashboardSubtitle: spec.subtitle, parentId, organizationId: organization.id },
        create: { id: spec.id, name: spec.name, description: spec.description, dashboardTitle: spec.name, dashboardSubtitle: spec.subtitle, parentId, organizationId: organization.id },
      });
      projects.set(spec.key, project.id);
    }

    const categories = new Map<string, string>();
    const fields = new Map<string, string>();
    for (const project of projectSpecs) {
      const projectId = projects.get(project.key)!;
      for (const category of categoryTemplates) {
        const id = `demo-category-${project.key}-${category.key}`;
        await tx.category.upsert({
          where: { id },
          update: { name: category.name, color: category.color, projectId },
          create: { id, name: category.name, color: category.color, projectId },
        });
        categories.set(`${project.key}:${category.key}`, id);
      }
      for (const [order, field] of fieldTemplates.entries()) {
        const id = `demo-field-${project.key}-${field.key}`;
        await tx.customFieldDefinition.upsert({
          where: { id },
          update: { name: field.name, type: field.type, config: json(field.config), order, projectId },
          create: { id, name: field.name, type: field.type, config: json(field.config), order, projectId },
        });
        fields.set(`${project.key}:${field.key}`, id);
      }
    }

    for (const [index, spec] of goalSpecs.entries()) {
      const projectId = projects.get(spec.projectKey)!;
      const status = statuses.get(spec.statusKey)!;
      const cycleId = cycles.get(spec.cycleKey)!;
      const owners = spec.ownerKeys.map((key) => memberName(members, key));
      const categoryIds = spec.categoryKeys.map((key) => categories.get(`${spec.projectKey}:${key}`)!);
      const lead = owners[0];
      const customFields = {
        [fields.get(`${spec.projectKey}:priority`)!]: spec.priority,
        [fields.get(`${spec.projectKey}:team`)!]: spec.teams,
        [fields.get(`${spec.projectKey}:effort`)!]: spec.effort,
        [fields.get(`${spec.projectKey}:release`)!]: spec.dueDate,
        [fields.get(`${spec.projectKey}:lead`)!]: [{ userId: lead.id, name: lead.name }],
        [fields.get(`${spec.projectKey}:riskNote`)!]: spec.riskNote,
      };
      const flags = { completed: status.kind === 'done', onHold: status.kind === 'on_hold' };

      await tx.goal.upsert({
        where: { id: spec.id },
        update: {
          title: spec.title,
          description: spec.description,
          owner: owners[0].name,
          projectId,
          progress: spec.progress,
          size: spec.size,
          startDate: spec.startDate,
          dueDate: spec.dueDate,
          statusNote: spec.riskNote,
          order: index,
          statusId: status.id,
          cycleId,
          parentGoalId: spec.alignedTo ?? null,
          customFields: json(customFields),
          ...flags,
          categories: { set: categoryIds.map((id) => ({ id })) },
        },
        create: {
          id: spec.id,
          title: spec.title,
          description: spec.description,
          owner: owners[0].name,
          projectId,
          progress: spec.progress,
          size: spec.size,
          startDate: spec.startDate,
          dueDate: spec.dueDate,
          statusNote: spec.riskNote,
          order: index,
          statusId: status.id,
          cycleId,
          parentGoalId: spec.alignedTo ?? null,
          customFields: json(customFields),
          ...flags,
          categories: { connect: categoryIds.map((id) => ({ id })) },
        },
      });

      await tx.goalOwner.deleteMany({ where: { goalId: spec.id } });
      await tx.goalOwner.createMany({
        data: owners.map((owner, order) => ({ id: `demo-goal-owner-${index}-${order}`, goalId: spec.id, ownerName: owner.name, userId: owner.id, order })),
      });

      const subGoalSpecs = [
        { suffix: 'discovery', title: '요구사항과 성공 기준 확정', progress: Math.min(100, spec.progress + 25), owner: owners[0], targetValue: 100, currentValue: Math.min(100, spec.progress + 25), unit: '%' },
        { suffix: 'design', title: '사용자 흐름과 기술 설계 리뷰', progress: Math.min(100, spec.progress + 12), owner: owners[1] ?? owners[0], targetValue: 1, currentValue: spec.progress >= 30 ? 1 : 0, unit: '건' },
        { suffix: 'build', title: '핵심 기능 구현 및 내부 검증', progress: Math.max(0, spec.progress - 5), owner: owners[1] ?? owners[0], targetValue: spec.effort, currentValue: Math.round(spec.effort * Math.max(0, spec.progress - 5) / 100), unit: 'SP' },
        { suffix: 'qa', title: '회귀 테스트와 출시 체크리스트', progress: Math.max(0, spec.progress - 20), owner: memberName(members, 'qa'), targetValue: 40, currentValue: Math.round(40 * Math.max(0, spec.progress - 20) / 100), unit: '케이스' },
        { suffix: 'launch', title: '점진 배포와 성과 측정', progress: Math.max(0, spec.progress - 35), owner: owners[owners.length - 1], targetValue: 1, currentValue: spec.progress >= 100 ? 1 : 0, unit: '회' },
      ];
      for (const [subOrder, sub] of subGoalSpecs.entries()) {
        const subGoalId = `${spec.id}-${sub.suffix}`;
        await tx.subGoal.upsert({
          where: { id: subGoalId },
          update: { title: sub.title, description: `${spec.title}의 ${sub.title} 작업`, owner: sub.owner.name, progress: sub.progress, startDate: spec.startDate, dueDate: spec.dueDate, goalId: spec.id, order: subOrder, targetValue: sub.targetValue, currentValue: sub.currentValue, startValue: 0, unit: sub.unit },
          create: { id: subGoalId, title: sub.title, description: `${spec.title}의 ${sub.title} 작업`, owner: sub.owner.name, progress: sub.progress, startDate: spec.startDate, dueDate: spec.dueDate, goalId: spec.id, order: subOrder, targetValue: sub.targetValue, currentValue: sub.currentValue, startValue: 0, unit: sub.unit },
        });
        await tx.subGoalOwner.deleteMany({ where: { subGoalId } });
        await tx.subGoalOwner.create({ data: { id: `demo-subgoal-owner-${spec.id}-${sub.suffix}`, subGoalId, ownerName: sub.owner.name, userId: sub.owner.id, order: 0 } });
      }

      await tx.note.upsert({
        where: { id: `demo-note-${index}` },
        update: { content: `이번 주 핵심 포인트: ${spec.riskNote}`, isPinned: index % 3 === 0, goalId: spec.id },
        create: { id: `demo-note-${index}`, content: `이번 주 핵심 포인트: ${spec.riskNote}`, isPinned: index % 3 === 0, goalId: spec.id },
      });
      await tx.note.upsert({
        where: { id: `demo-note-decision-${index}` },
        update: { content: `최근 결정: ${spec.title}은(는) ${spec.dueDate}까지 현재 범위를 유지하고, 추가 요청은 다음 사이클 후보로 분리합니다.`, isPinned: false, goalId: spec.id },
        create: { id: `demo-note-decision-${index}`, content: `최근 결정: ${spec.title}은(는) ${spec.dueDate}까지 현재 범위를 유지하고, 추가 요청은 다음 사이클 후보로 분리합니다.`, isPinned: false, goalId: spec.id },
      });

      const confidence = spec.statusKey === 'risk' ? 'at_risk' : spec.statusKey === 'hold' ? 'off_track' : 'on_track';
      const checkInSpecs = [
        { id: `demo-checkin-early-${index}`, progress: Math.max(0, spec.progress - 18), createdAt: new Date(Date.UTC(2026, 7, 4 + (index % 7), 1, 0, 0)), note: '초기 범위와 의존성을 점검하고 실행 계획을 갱신했습니다.' },
        { id: `demo-checkin-mid-${index}`, progress: Math.max(0, spec.progress - 9), createdAt: new Date(Date.UTC(2026, 7, 14 + (index % 7), 1, 0, 0)), note: '핵심 산출물이 준비되어 이해관계자 리뷰를 시작했습니다.' },
        { id: `demo-checkin-${index}`, progress: spec.progress, createdAt: new Date(Date.UTC(2026, 7, 24 + (index % 7), 1, 0, 0)), note: `진행률 ${spec.progress}% 기준으로 업데이트했습니다. ${spec.riskNote}` },
      ];
      for (const checkIn of checkInSpecs) {
        await tx.checkIn.upsert({
          where: { id: checkIn.id },
          update: { goalId: spec.id, userId: owners[0].id, progress: checkIn.progress, confidence, note: checkIn.note, createdAt: checkIn.createdAt },
          create: { ...checkIn, goalId: spec.id, userId: owners[0].id, confidence },
        });
      }

      const commentId = `demo-comment-${index}`;
      await tx.comment.upsert({
        where: { id: commentId },
        update: { goalId: spec.id, authorId: owners[0].id, authorName: owners[0].name, body: `현재 가장 중요한 판단 포인트는 “${spec.riskNote}”입니다. 다음 체크인에서 수치로 확인하겠습니다.` },
        create: { id: commentId, goalId: spec.id, authorId: owners[0].id, authorName: owners[0].name, body: `현재 가장 중요한 판단 포인트는 “${spec.riskNote}”입니다. 다음 체크인에서 수치로 확인하겠습니다.`, createdAt: new Date(Date.UTC(2026, 7, 15 + (index % 12), 2, 0, 0)) },
      });
      const replyAuthor = owners[1] ?? owners[0];
      await tx.comment.upsert({
        where: { id: `demo-comment-reply-${index}` },
        update: { goalId: spec.id, authorId: replyAuthor.id, authorName: replyAuthor.name, parentId: commentId, body: '확인했습니다. 담당 작업과 일정에 반영하고 결과를 공유하겠습니다.' },
        create: { id: `demo-comment-reply-${index}`, goalId: spec.id, authorId: replyAuthor.id, authorName: replyAuthor.name, parentId: commentId, body: '확인했습니다. 담당 작업과 일정에 반영하고 결과를 공유하겠습니다.', createdAt: new Date(Date.UTC(2026, 7, 15 + (index % 12), 5, 0, 0)) },
      });
      if (index % 3 === 0) {
        const reviewer = memberName(members, index % 2 === 0 ? 'pm' : 'qa');
        await tx.comment.upsert({
          where: { id: `demo-comment-review-${index}` },
          update: { goalId: spec.id, authorId: reviewer.id, authorName: reviewer.name, body: `리뷰 의견: “${spec.title}”의 완료 기준에 실제 사용자 검증 결과를 포함해주세요.` },
          create: { id: `demo-comment-review-${index}`, goalId: spec.id, authorId: reviewer.id, authorName: reviewer.name, body: `리뷰 의견: “${spec.title}”의 완료 기준에 실제 사용자 검증 결과를 포함해주세요.`, createdAt: new Date(Date.UTC(2026, 7, 22 + (index % 7), 6, 0, 0)) },
        });
      }

      await tx.auditLog.upsert({
        where: { id: `demo-audit-${index}` },
        update: { action: index % 4 === 0 ? 'CREATE' : 'UPDATE', entityType: 'Goal', entityId: spec.id, entityTitle: spec.title, goalId: spec.id, projectId, organizationId: organization.id, summary: `${spec.title} 진행률을 ${spec.progress}%로 업데이트`, userId: owners[0].id, changes: JSON.stringify({ progress: spec.progress, status: status.id }) },
        create: { id: `demo-audit-${index}`, action: index % 4 === 0 ? 'CREATE' : 'UPDATE', entityType: 'Goal', entityId: spec.id, entityTitle: spec.title, goalId: spec.id, projectId, organizationId: organization.id, summary: `${spec.title} 진행률을 ${spec.progress}%로 업데이트`, userId: owners[0].id, changes: JSON.stringify({ progress: spec.progress, status: status.id }), createdAt: new Date(Date.UTC(2026, 7, 5 + (index % 25), 3, 0, 0)) },
      });
      await tx.auditLog.upsert({
        where: { id: `demo-audit-status-${index}` },
        update: { action: 'UPDATE', entityType: 'Goal', entityId: spec.id, entityTitle: spec.title, goalId: spec.id, projectId, organizationId: organization.id, summary: `${spec.title} 상태와 담당자를 최신 계획에 맞게 조정`, userId: replyAuthor.id, changes: JSON.stringify({ statusId: status.id, owners: owners.map((owner) => owner.name) }) },
        create: { id: `demo-audit-status-${index}`, action: 'UPDATE', entityType: 'Goal', entityId: spec.id, entityTitle: spec.title, goalId: spec.id, projectId, organizationId: organization.id, summary: `${spec.title} 상태와 담당자를 최신 계획에 맞게 조정`, userId: replyAuthor.id, changes: JSON.stringify({ statusId: status.id, owners: owners.map((owner) => owner.name) }), createdAt: new Date(Date.UTC(2026, 7, 18 + (index % 12), 4, 0, 0)) },
      });
    }

    const owner = memberName(members, 'owner');
    const pm = memberName(members, 'pm');
    const webProjectId = projects.get('web')!;
    const aiProjectId = projects.get('ai')!;

    const savedViews = [
      { id: 'demo-view-web-table', projectId: webProjectId, name: '이번 분기 실행 항목', type: 'table', isShared: true, isDefault: true, order: 0, config: { v: 1, groupBy: 'status', sorting: [{ id: 'dueDate', desc: false }], columnVisibility: { description: false } } },
      { id: 'demo-view-web-board', projectId: webProjectId, name: '개발 흐름 보드', type: 'board', isShared: true, isDefault: false, order: 1, config: { v: 1, filters: { cycle: 'demo-cycle-q3' }, kanbanFieldId: 'status' } },
      { id: 'demo-view-ai-risk', projectId: aiProjectId, name: 'AI 위험 항목', type: 'table', isShared: true, isDefault: false, order: 0, config: { v: 1, filters: { statuses: [statuses.get('risk')!.id] }, groupBy: 'owner' } },
      { id: 'demo-view-executive', projectId: projects.get('strategy')!, name: '경영진 대시보드', type: 'dashboard', isShared: true, isDefault: true, order: 0, config: { v: 1, widgets: [{ type: 'progress-summary' }, { type: 'status-distribution' }, { type: 'due-soon' }] } },
      { id: 'demo-view-strategy-risks', projectId: projects.get('strategy')!, name: '전사 위험 및 의존성', type: 'table', isShared: true, isDefault: false, order: 1, config: { v: 1, filters: { statuses: [statuses.get('risk')!.id, statuses.get('hold')!.id] }, groupBy: 'owner' } },
      { id: 'demo-view-mobile-release', projectId: projects.get('mobile')!, name: '모바일 출시 준비', type: 'board', isShared: true, isDefault: true, order: 0, config: { v: 1, filters: { cycle: 'demo-cycle-q3' }, kanbanFieldId: 'status' } },
      { id: 'demo-view-mobile-quality', projectId: projects.get('mobile')!, name: '모바일 품질 체크', type: 'table', isShared: true, isDefault: false, order: 1, config: { v: 1, groupBy: 'status', sorting: [{ id: 'progress', desc: true }] } },
      { id: 'demo-view-dx-weekly', projectId: projects.get('dx')!, name: '플랫폼 주간 실행', type: 'table', isShared: true, isDefault: true, order: 0, config: { v: 1, groupBy: 'status', sorting: [{ id: 'dueDate', desc: false }] } },
      { id: 'demo-view-dx-health', projectId: projects.get('dx')!, name: '개발 생산성 대시보드', type: 'dashboard', isShared: true, isDefault: false, order: 1, config: { v: 1, widgets: [{ type: 'status-distribution' }, { type: 'owner-workload' }, { type: 'due-soon' }] } },
      { id: 'demo-view-success-renewal', projectId: projects.get('success')!, name: '갱신 위험 고객 대응', type: 'table', isShared: true, isDefault: true, order: 0, config: { v: 1, groupBy: 'owner', sorting: [{ id: 'dueDate', desc: false }] } },
      { id: 'demo-view-success-voice', projectId: projects.get('success')!, name: '고객 목소리 보드', type: 'board', isShared: true, isDefault: false, order: 1, config: { v: 1, kanbanFieldId: 'status' } },
    ];
    for (const view of savedViews) {
      await tx.savedView.upsert({
        where: { id: view.id },
        update: { ...view, organizationId: organization.id, createdById: owner.id, config: json(view.config) },
        create: { ...view, organizationId: organization.id, createdById: owner.id, config: json(view.config) },
      });
    }

    const automationRules = [
      { id: 'demo-rule-due', projectId: webProjectId, name: '마감 3일 전 담당자 알림', triggerType: 'due_date_approaching', triggerConfig: { daysBefore: 3 }, condition: [{ attr: 'completed', op: 'eq', value: false }], actions: [{ type: 'notify_assignees', config: { message: '마감일이 3일 남았습니다.' } }] },
      { id: 'demo-rule-risk', projectId: aiProjectId, name: '위험 상태 변경 시 PM 알림', triggerType: 'status_changed', triggerConfig: { statusId: statuses.get('risk')!.id }, condition: null, actions: [{ type: 'notify_users', config: { userIds: [pm.id], message: 'AI 프로젝트에 위험 항목이 생겼습니다.' } }] },
      { id: 'demo-rule-complete', projectId: projects.get('success')!, name: '100% 달성 시 완료 상태로 이동', triggerType: 'progress_reached', triggerConfig: { threshold: 100 }, condition: null, actions: [{ type: 'set_status', config: { statusId: statuses.get('done')!.id } }] },
      { id: 'demo-rule-mobile-review', projectId: projects.get('mobile')!, name: '배포 대기 시 QA 확인 요청', triggerType: 'status_changed', triggerConfig: { statusId: statuses.get('deploy')!.id }, condition: null, actions: [{ type: 'notify_users', config: { userIds: [memberName(members, 'qa').id], message: '모바일 출시 체크리스트를 확인해주세요.' } }] },
      { id: 'demo-rule-dx-risk', projectId: projects.get('dx')!, name: '플랫폼 위험 목표 운영 채널 알림', triggerType: 'status_changed', triggerConfig: { statusId: statuses.get('risk')!.id }, condition: null, actions: [{ type: 'notify_assignees', config: { message: '플랫폼 위험 목표의 대응 계획을 갱신해주세요.' } }] },
      { id: 'demo-rule-strategy-checkin', projectId: projects.get('strategy')!, name: '경영 목표 주간 체크인 리마인더', triggerType: 'schedule', triggerConfig: { cron: '0 9 * * 1' }, condition: [{ attr: 'completed', op: 'eq', value: false }], actions: [{ type: 'notify_assignees', config: { message: '이번 주 경영 목표 체크인을 작성해주세요.' } }] },
    ];
    for (const rule of automationRules) {
      await tx.automationRule.upsert({
        where: { id: rule.id },
        update: { organizationId: organization.id, projectId: rule.projectId, name: rule.name, enabled: true, triggerType: rule.triggerType, triggerConfig: json(rule.triggerConfig), condition: rule.condition ? json(rule.condition) : Prisma.JsonNull, actions: json(rule.actions), createdById: owner.id },
        create: { id: rule.id, organizationId: organization.id, projectId: rule.projectId, name: rule.name, enabled: true, triggerType: rule.triggerType, triggerConfig: json(rule.triggerConfig), condition: rule.condition ? json(rule.condition) : Prisma.JsonNull, actions: json(rule.actions), createdById: owner.id },
      });
    }

    const notifications = [
      { id: 'demo-notification-1', type: 'MENTION', title: '목표 댓글에서 회원님을 멘션했습니다', body: '엔터프라이즈 보안 요건의 심사 일정을 확인해주세요.', entityId: 'demo-goal-enterprise', read: false },
      { id: 'demo-notification-2', type: 'DUE_SOON', title: '마감 임박 목표가 있습니다', body: '서비스 관측성 표준화 목표의 마감일이 다가옵니다.', entityId: 'demo-goal-observability', read: false },
      { id: 'demo-notification-3', type: 'STATUS_CHANGED', title: '목표 상태가 고객 검증으로 변경되었습니다', body: '주간 목표 요약 코파일럿이 고객 검증 단계에 들어갔습니다.', entityId: 'demo-goal-summary', read: true },
      { id: 'demo-notification-4', type: 'CHECK_IN', title: '새 체크인이 등록되었습니다', body: 'iOS 베타 출시 진행률이 68%로 업데이트되었습니다.', entityId: 'demo-goal-ios', read: false },
      { id: 'demo-notification-5', type: 'COMMENT', title: '새로운 리뷰 의견이 등록되었습니다', body: '목표 일괄 편집 기능의 부분 실패 처리 방식을 확인해주세요.', entityId: 'demo-goal-web-portfolio-2', read: false },
      { id: 'demo-notification-6', type: 'ASSIGNED', title: '새 목표의 담당자로 지정되었습니다', body: '파트너 API 생태계 정책 설계 목표에 담당자로 추가되었습니다.', entityId: 'demo-goal-strategy-portfolio-7', read: false },
      { id: 'demo-notification-7', type: 'DUE_SOON', title: '이번 주 마감 목표 4개', body: '웹 플랫폼과 개발자 경험 프로젝트의 마감 항목을 확인해주세요.', entityId: 'demo-goal-web-portfolio-1', read: false },
      { id: 'demo-notification-8', type: 'STATUS_CHANGED', title: '모바일 목표가 코드 리뷰 단계로 이동했습니다', body: '알림 딥링크 라우팅 구현이 리뷰를 기다리고 있습니다.', entityId: 'demo-goal-mobile-portfolio-4', read: true },
      { id: 'demo-notification-9', type: 'CHECK_IN', title: 'AI 비용 목표 체크인', body: '모델 비용 관측 대시보드의 진행률과 리스크가 갱신되었습니다.', entityId: 'demo-goal-ai-portfolio-5', read: false },
      { id: 'demo-notification-10', type: 'MENTION', title: '장애 대응 훈련에서 회원님을 멘션했습니다', body: '다음 훈련 시나리오 승인과 참여 팀 확정이 필요합니다.', entityId: 'demo-goal-dx-portfolio-5', read: false },
      { id: 'demo-notification-11', type: 'COMMENT', title: '고객 건강도 점수에 의견이 추가되었습니다', body: '소규모 고객군의 보정 계수를 데이터팀과 검토해주세요.', entityId: 'demo-goal-success-portfolio-2', read: true },
      { id: 'demo-notification-12', type: 'ASSIGNED', title: '전사 위험 목표 담당자로 지정되었습니다', body: '핵심 제품 지표 신뢰도 개선에 우선순위가 지정되었습니다.', entityId: 'demo-goal-strategy-portfolio-2', read: false },
    ];
    for (const [index, notification] of notifications.entries()) {
      await tx.notification.upsert({
        where: { id: notification.id },
        update: { ...notification, organizationId: organization.id, recipientId: owner.id, actorId: pm.id, actorName: pm.name, entityType: 'Goal' },
        create: { ...notification, organizationId: organization.id, recipientId: owner.id, actorId: pm.id, actorName: pm.name, entityType: 'Goal', createdAt: new Date(Date.UTC(2026, 7, 28 + index, 8, 0, 0)) },
      });
    }

    await tx.setting.upsert({
      where: { key_organizationId: { key: 'companyProfile', organizationId: organization.id } },
      update: { value: JSON.stringify({ industry: 'Software', stage: 'Growth', employees: 48 }) },
      create: { key: 'companyProfile', value: JSON.stringify({ industry: 'Software', stage: 'Growth', employees: 48 }), organizationId: organization.id },
    });

    return {
      userId: owner.id,
      organizationId: organization.id,
      users: memberSpecs.length,
      projects: projectSpecs.length,
      goals: goalSpecs.length,
      subGoals: goalSpecs.length * 5,
      notes: goalSpecs.length * 2,
      checkIns: goalSpecs.length * 3,
      comments: goalSpecs.length * 2 + Math.ceil(goalSpecs.length / 3),
      auditLogs: goalSpecs.length * 2,
      statusLabels: statusSpecs.length,
      cycles: cycleSpecs.length,
      categories: projectSpecs.length * categoryTemplates.length,
      customFields: projectSpecs.length * fieldTemplates.length,
      savedViews: savedViews.length,
      automationRules: automationRules.length,
      notifications: notifications.length,
    };
  }, { maxWait: 10_000, timeout: 60_000 });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
