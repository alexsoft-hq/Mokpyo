import { useTranslation, t } from '@/i18n';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { LegalDocument, LegalList, LegalSection } from '@/components/marketing/LegalDocument';
import { usePageTitle } from '@/components/marketing/usePageTitle';

export default function Privacy() {
  useTranslation();
  usePageTitle(t("개인정보 처리 안내"));
  return (
    <MarketingLayout>
      <LegalDocument title={t("개인정보 처리 안내")} notice={t("이 페이지는 소프트웨어의 데이터 처리 구조를 설명합니다. 이 서버 운영자의 확정된 개인정보처리방침이 아닙니다. 가입·사용 전에 운영자의 방침과 연락처를 확인하세요.")}>
        <LegalSection heading={t("데이터를 관리하는 주체")}>
          <p>{t("Mokpyo를 설치해 운영하는 조직이 해당 서버의 계정과 업무 데이터를 관리합니다. 오픈소스 개발자인 ALEXSOFT가 모든 설치 서버의 데이터를 관리하는 것은 아닙니다.")}</p>
          <p>{t("운영자는 실제 설정에 맞춰 처리 주체와 연락처, 처리 목적과 항목, 보유 기간, 삭제·백업 정책, 이용자 요청 절차, 외부 제공자와 국외 이전 여부를 별도로 안내해야 합니다.")}</p>
        </LegalSection>
        <LegalSection heading={t("사용 중 처리되는 데이터")}>
          <LegalList items={[
            t("계정의 이메일·이름 등 프로필 정보와 로그인에 필요한 인증 정보"),
            t("워크스페이스 구성원, 목표, 진행률, 댓글, 첨부파일 등 입력한 업무 자료"),
            t("목표 변경과 활동 이력 등 기능 동작에 필요한 기록"),
          ]} />
          <p>{t("저장 위치와 접근 권한, 보유 기간은 설치 환경과 운영 방식에 따라 달라집니다. 서버 설정과 백업에 남은 데이터도 운영자가 관리해야 합니다.")}</p>
        </LegalSection>
        <LegalSection heading={t("선택한 외부 연동")}>
          <LegalList items={[
            t("AI 기능을 활성화하고 사용하면 목표·활동 내용 등 요청 처리에 필요한 텍스트가 설정된 Azure OpenAI 엔드포인트로 전송됩니다."),
            t("SMTP를 설정하면 이메일 발송에 필요한 수신 주소와 메시지가 메일 제공자에게 전달됩니다."),
            t("Google OAuth 로그인을 설정하고 사용하면 인증 과정에서 Google과 계정 정보가 교환됩니다."),
            t("Amazon S3를 설정하면 첨부파일이 운영자가 지정한 저장소에 보관됩니다."),
          ]} />
          <p>{t("연동 여부와 제공자, 저장 지역 및 처리 조건을 운영자에게 확인하세요. 민감한 업무 자료를 입력하기 전에 AI 등 외부 연동의 사용 범위를 확인해야 합니다.")}</p>
        </LegalSection>
        <LegalSection heading={t("열람·수정·삭제 문의")}>
          <p>{t("개인정보의 열람·수정·삭제, 계정과 워크스페이스 데이터, 백업 처리에 관한 요청은 이용 중인 서버 운영자에게 보내세요. 구체적인 처리 절차와 기간은 해당 운영자의 방침을 확인하세요.")}</p>
        </LegalSection>
      </LegalDocument>
    </MarketingLayout>
  );
}
