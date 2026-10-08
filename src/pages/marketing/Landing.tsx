import { Link } from 'react-router-dom';
import {
  AtSign,
  BarChart3,
  Bell,
  Bookmark,
  ClipboardCheck,
  GanttChart,
  History,
  KanbanSquare,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ProductPreview } from '@/components/marketing/ProductPreview';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { FaqList, type FaqItem } from '@/components/marketing/FaqList';
import { PlanCard } from '@/components/marketing/PlanCard';
import { OPEN_SOURCE_NOTICE, PLANS } from '@/components/marketing/plans';
import { CONSULTING_URL, INSTALL_GUIDE_URL } from '@/components/marketing/projectLinks';
import { usePageTitle } from '@/components/marketing/usePageTitle';

const VIEWS = [
  {
    icon: LayoutGrid,
    title: '카드',
    description: '목표를 카드로 훑어봅니다. 담당자와 진행률, 마감이 카드 한 장에 모여 있습니다.',
  },
  {
    icon: Table2,
    title: '테이블',
    description: '많은 목표를 한 번에 비교하고 정렬합니다. 값은 표 안에서 바로 고칩니다.',
  },
  {
    icon: KanbanSquare,
    title: '보드',
    description: '상태별로 목표를 늘어놓고 끌어 옮깁니다. 진행 단계는 팀이 직접 정합니다.',
  },
  {
    icon: GanttChart,
    title: '타임라인',
    description: '기간과 겹침을 가로 막대로 봅니다. 마감이 몰리는 구간을 미리 찾습니다.',
  },
  {
    icon: BarChart3,
    title: '대시보드',
    description: '프로젝트·담당자별 진행 상황을 집계합니다. 숫자에서 목표로 바로 들어갑니다.',
  },
] as const;

const COLLABORATION = [
  {
    icon: MessageSquare,
    title: '목표 안에서 오가는 논의',
    description: '목표마다 댓글이 붙습니다. 결정과 근거가 목표 옆에 남아 나중에 다시 읽힙니다.',
  },
  {
    icon: AtSign,
    title: '@멘션과 알림',
    description: '담당자를 멘션하면 알림이 갑니다. 지정·마감·상태 변경도 알림으로 전달됩니다.',
  },
  {
    icon: Workflow,
    title: '자동화 규칙',
    description: '트리거와 조건, 액션을 골라 규칙을 만듭니다. 상태가 바뀌면 담당자 지정이나 알림이 자동으로 이어집니다.',
  },
  {
    icon: Bookmark,
    title: '저장된 뷰 공유',
    description: '자주 쓰는 필터와 정렬을 저장해 팀에 공유합니다. 같은 화면을 같은 조건으로 봅니다.',
  },
  {
    icon: SlidersHorizontal,
    title: '커스텀 필드',
    description: '팀에 필요한 항목을 직접 추가합니다. 추가한 필드는 테이블과 필터에서 함께 쓰입니다.',
  },
  {
    icon: Bell,
    title: '놓치지 않는 마감',
    description: '마감이 다가오면 알림으로 알려 줍니다. 진행률은 하위 목표에서 자동으로 올라옵니다.',
  },
] as const;

const OKR = [
  {
    icon: RefreshCw,
    title: '사이클',
    description: '분기 같은 기간 단위로 목표를 묶습니다. 사이클이 끝나면 결과를 그대로 돌아봅니다.',
  },
  {
    icon: Target,
    title: 'Key Result',
    description: '목표마다 정량 지표를 답니다. 시작값과 목표값을 두면 달성률이 자동으로 계산됩니다.',
  },
  {
    icon: ClipboardCheck,
    title: '체크인 이력',
    description: '진행률이 바뀔 때 자동으로 스냅샷을 남깁니다. 언제 얼마나 움직였는지 이력을 돌아봅니다.',
  },
  {
    icon: Network,
    title: '상위 목표 정렬',
    description: '하위 목표를 상위 목표에 연결합니다. 팀의 일이 회사 목표와 어떻게 이어지는지 보입니다.',
  },
] as const;

const TRUST = [
  {
    icon: ShieldCheck,
    title: '워크스페이스 단위 데이터 격리',
    description: '모든 데이터는 워크스페이스에 묶입니다. 다른 워크스페이스의 목표는 조회되지 않습니다.',
  },
  {
    icon: Users,
    title: '역할 기반 권한',
    description: 'OWNER·ADMIN·MEMBER 역할로 설정과 삭제 권한을 나눕니다.',
  },
  {
    icon: History,
    title: '변경 이력',
    description: '목표의 주요 변경과 활동을 기록합니다. 활동 피드에서 진행 과정을 되짚어 볼 수 있습니다.',
  },
  {
    icon: Server,
    title: '직접 설치하고 운영',
    description: '공개된 소스와 설치 문서로 조직의 서버에 설치합니다. 백업과 접근 정책은 운영자가 관리합니다.',
  },
] as const;

const FAQS: FaqItem[] = [
  {
    question: '지금 바로 쓸 수 있습니까.',
    answer:
      'GitHub의 설치 가이드로 서버를 구성한 뒤 사용합니다. 이미 설치된 서버를 이용한다면 해당 서버에 가입할 수 있습니다.',
  },
  {
    question: 'OKR을 안 쓰는 팀도 쓸 수 있습니까.',
    answer:
      'Key Result와 사이클은 선택 기능입니다. 목표와 마감, 담당자만으로도 카드·테이블·보드·타임라인을 그대로 쓸 수 있습니다.',
  },
  {
    question: '기존에 쓰던 목록을 옮길 수 있습니까.',
    answer:
      '목표는 테이블 뷰에서 여러 건을 빠르게 입력하고 수정할 수 있습니다. 맞춤 이관 작업은 ALEXSOFT와 별도 용역으로 상담할 수 있습니다.',
  },
  {
    question: '진행률은 어떻게 계산됩니까.',
    answer:
      '하위 목표가 있으면 하위 진행률이 상위로 올라옵니다. Key Result가 있으면 시작값과 목표값 사이에서 현재값의 비율로 계산합니다.',
  },
  {
    question: '데이터는 어디에 저장됩니까.',
    answer:
      '데이터는 설치한 서버와 운영자가 설정한 저장소에 저장됩니다. AI·메일·로그인 등 외부 연동을 켜면 해당 제공자에게 필요한 데이터가 전달될 수 있습니다.',
  },
];

export default function Landing() {
  usePageTitle();

  return (
    <MarketingLayout>
      {/* 히어로 */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 pt-16 md:pt-24 pb-12 md:pb-16">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight text-foreground">
              팀의 목표를 한 화면에서.
              <br />
              계획부터 달성까지.
            </h1>
            <p className="mt-5 text-base md:text-lg leading-relaxed text-muted-foreground">
              ALEXSOFT가 만든 오픈소스 목표·OKR 도구입니다. 조직의 서버에 설치하고, 팀의 방식에 맞게 수정해 쓰세요.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg">
                <a href={INSTALL_GUIDE_URL}>설치 가이드</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={CONSULTING_URL}>ALEXSOFT 상담</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{OPEN_SOURCE_NOTICE}</p>
          </div>

          <div className="mt-12 md:mt-16">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* 5개 뷰 */}
      <Section id="features">
        <SectionHeading
          eyebrow="뷰"
          title="같은 목표를 다섯 가지로 봅니다."
          description="보는 방식만 바뀔 뿐 데이터는 하나입니다. 어느 뷰에서 고쳐도 나머지 뷰에 그대로 반영됩니다."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VIEWS.map(({ icon: Icon, title, description }) => (
            <FeatureCard key={title} Icon={Icon} title={title} description={description} />
          ))}
        </div>
      </Section>

      {/* 협업·자동화 */}
      <Section muted>
        <SectionHeading
          eyebrow="협업과 자동화"
          title="사람 손이 덜 가게 만듭니다."
          description="상태를 옮기고 알리고 정리하는 반복 작업은 규칙으로 넘깁니다."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLLABORATION.map(({ icon: Icon, title, description }) => (
            <FeatureCard key={title} Icon={Icon} title={title} description={description} surface="background" />
          ))}
        </div>
      </Section>

      {/* OKR */}
      <Section>
        <SectionHeading
          eyebrow="OKR"
          title="목표를 숫자로 관리합니다."
          description="선언에서 끝나지 않도록 지표와 체크인을 목표에 붙입니다."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {OKR.map(({ icon: Icon, title, description }) => (
            <FeatureCard key={title} Icon={Icon} title={title} description={description} />
          ))}
        </div>
      </Section>

      {/* 신뢰 */}
      <Section muted>
        <SectionHeading
          eyebrow="보안과 운영"
          title="운영은 조직의 환경에 맞게."
          description="권한과 기록을 제품 기본값으로 둡니다."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TRUST.map(({ icon: Icon, title, description }) => (
            <FeatureCard key={title} Icon={Icon} title={title} description={description} surface="background" />
          ))}
        </div>
      </Section>

      {/* 도입 안내 */}
      <Section id="adoption">
        <SectionHeading eyebrow="오픈소스 도입" title="직접 쓰고, 고치고, 함께 만듭니다." description={OPEN_SOURCE_NOTICE} />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} maxFeatures={4} />
          ))}
        </div>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link to="/pricing">
              <ListChecks aria-hidden="true" />
              도입과 지원 안내
            </Link>
          </Button>
        </div>
      </Section>

      {/* FAQ */}
      <Section muted>
        <SectionHeading title="자주 묻는 질문" />
        <div className="mt-8 max-w-3xl">
          <FaqList items={FAQS} />
        </div>
      </Section>

      {/* 마지막 CTA */}
      <Section>
        <div className="rounded-xl border border-border bg-card p-8 md:p-12 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            이번 분기 목표부터 옮겨 보세요.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            소스를 살펴보고 직접 설치해 보세요. 조직에 맞는 설계·개발·연동이 필요하면 ALEXSOFT와 상담할 수 있습니다.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg">
              <a href={INSTALL_GUIDE_URL}>설치 가이드</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={CONSULTING_URL}>ALEXSOFT 상담</a>
            </Button>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}

interface FeatureCardProps {
  Icon: LucideIcon;
  title: string;
  description: string;
  /** 섹션 배경이 card 일 때는 카드를 background 로 뒤집어 대비를 유지한다. */
  surface?: 'card' | 'background';
}

function FeatureCard({ Icon, title, description, surface = 'card' }: FeatureCardProps) {
  return (
    <div
      className={`h-full rounded-xl border border-border p-5 shadow-sm transition-shadow hover:shadow-md ${
        surface === 'card' ? 'bg-card' : 'bg-background'
      }`}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
