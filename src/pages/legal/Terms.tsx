import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { LegalDocument, LegalSection } from '@/components/marketing/LegalDocument';
import { CONSULTING_URL, LICENSE_URL } from '@/components/marketing/projectLinks';
import { usePageTitle } from '@/components/marketing/usePageTitle';

export default function Terms() {
  usePageTitle('라이선스·이용 안내');
  return (
    <MarketingLayout>
      <LegalDocument title="라이선스·이용 안내" notice="이 페이지는 오픈소스 소프트웨어의 이용 안내입니다. 특정 서버의 서비스 이용약관을 대신하지 않습니다.">
        <LegalSection heading="소프트웨어 라이선스">
          <p>Mokpyo는 MIT 라이선스로 공개됩니다. 개인과 조직은 소프트웨어를 사용·복사·수정·배포하고 상업적으로 활용할 수 있습니다. 복사본 또는 소프트웨어의 상당 부분에 저작권 및 라이선스 고지를 포함해야 합니다.</p>
          <p>소프트웨어는 보증 없이 제공되며, 구체적인 허용 범위와 책임 제한은 <a href={LICENSE_URL} className="text-primary underline underline-offset-4">MIT 라이선스 원문</a>을 확인하세요. 포함된 외부 패키지에는 각 패키지의 라이선스가 적용됩니다.</p>
        </LegalSection>
        <LegalSection heading="설치된 서버의 이용">
          <p>계정과 업무 데이터는 가입한 서버에서 관리됩니다. 오픈소스 공개 자체가 ALEXSOFT의 호스팅 제공, 데이터 보관, 백업 또는 지속적인 지원을 의미하지 않습니다.</p>
          <p>서버 운영자는 이용 조건, 계정 관리, 데이터 보관·삭제, 장애 대응과 문의 창구를 정해 이용자에게 안내해야 합니다. 가입 전에 해당 서버 운영자의 안내를 확인하세요.</p>
        </LegalSection>
        <LegalSection heading="설계·개발·도입 지원">
          <p>ALEXSOFT의 설치·설계·개발·연동 작업은 별도 계약으로 제공됩니다. 비용, 결과물, 일정, 유지보수와 지원 조건은 계약 범위에 따르며 MIT 라이선스의 사용 권한과 구분됩니다.</p>
          <p><a href={CONSULTING_URL} className="text-primary underline underline-offset-4">ALEXSOFT 상담</a>에서 필요한 작업을 문의할 수 있습니다.</p>
        </LegalSection>
      </LegalDocument>
    </MarketingLayout>
  );
}
