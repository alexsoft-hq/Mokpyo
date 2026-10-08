import { useTranslation, t } from '@/i18n';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { FaqList, type FaqItem } from '@/components/marketing/FaqList';
import { PlanCard } from '@/components/marketing/PlanCard';
import { OPEN_SOURCE_NOTICE, PLANS } from '@/components/marketing/plans';
import { CONSULTING_URL, INSTALL_GUIDE_URL } from '@/components/marketing/projectLinks';
import { usePageTitle } from '@/components/marketing/usePageTitle';

const FAQS: FaqItem[] = [
  { question: '회사에서도 무료로 사용할 수 있습니까.', answer: '네. MIT 라이선스에 따라 조직 내부 사용, 수정, 재배포와 상업적 활용이 가능합니다. 복사본 또는 소프트웨어의 상당 부분에는 저작권 및 라이선스 고지를 포함해야 합니다.' },
  { question: '무료로 호스팅해 주는 서비스입니까.', answer: 'Mokpyo는 직접 설치해 운영하는 소프트웨어입니다. 서버, 데이터베이스, 백업과 외부 서비스의 비용 및 운영은 설치한 조직이 담당합니다.' },
  { question: '기능을 쓰려면 유료 구독이 필요합니까.', answer: '공개된 소프트웨어를 사용하기 위한 SaaS 구독은 없습니다. 외부 AI·메일·스토리지 연동은 운영자가 설정하며, 해당 제공자의 이용료가 발생할 수 있습니다.' },
  { question: '설치나 맞춤 개발을 맡길 수 있습니까.', answer: 'ALEXSOFT에 설계·개발·설치·시스템 연동을 의뢰할 수 있습니다. 범위와 일정, 비용, 유지보수 조건은 별도 협의하며 오픈소스 라이선스와 구분됩니다.' },
];

export default function Pricing() {
  useTranslation();
  usePageTitle(t("도입과 지원"));
  return (
    <MarketingLayout>
      <Section className="pb-8 md:pb-10">
        <SectionHeading eyebrow={t("도입과 지원")} title={t("소프트웨어는 자유롭게. 필요한 도움은 함께.")} description={t("직접 설치하고 수정해 쓰세요. 조직에 맞춘 설계와 개발이 필요할 때 ALEXSOFT가 함께합니다.")} />
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-border bg-card p-4 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>{t(OPEN_SOURCE_NOTICE)}</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </div>
      </Section>
      <Section muted>
        <SectionHeading title={t("설치 전에 확인하세요")} />
        <div className="mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>{t("설치 가이드에서 실행 환경과 설정을 확인하세요. 운영 서버의 HTTPS, 접근 권한, 백업·복구와 업데이트는 운영자가 관리합니다.")}</p>
          <p>{t("멤버 수에 따른 소프트웨어 사용료는 없습니다. 실제 사용 가능한 용량과 외부 연동은 서버 자원과 운영자 설정에 따라 달라집니다.")}</p>
          <p>{t("프로젝트는 MIT 라이선스 조건에 따라 보증 없이 제공됩니다. 지속적인 지원이나 응답 시간이 필요하면 별도의 지원 범위를 협의하세요.")}</p>
        </div>
      </Section>
      <Section>
        <SectionHeading title={t("자주 묻는 질문")} />
        <div className="mt-8 max-w-3xl"><FaqList items={FAQS.map(item => ({ question: t(item.question), answer: t(item.answer) }))} /></div>
      </Section>
      <Section muted>
        <div className="rounded-xl border border-border bg-background p-8 md:p-12 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{t("우리 조직의 도구로 만들어 보세요.")}</h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{t("Mokpyo의 소스를 바탕으로 시작하거나, ALEXSOFT와 업무에 맞는 제품을 설계하세요.")}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg"><a href={INSTALL_GUIDE_URL}>{t("설치 가이드")}</a></Button>
            <Button asChild size="lg" variant="outline"><a href={CONSULTING_URL}>{t("ALEXSOFT 상담")}</a></Button>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}
