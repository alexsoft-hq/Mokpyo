import { CONSULTING_URL, INSTALL_GUIDE_URL, REPOSITORY_URL } from './projectLinks';

export interface Plan {
  id: 'self-host' | 'customize' | 'consulting';
  name: string;
  price: string;
  priceNote: string;
  summary: string;
  features: string[];
  highlighted?: boolean;
  cta: { label: string; href: string };
}

/** 소프트웨어 사용과 별도 계약으로 제공하는 용역을 구분한다. */
export const PLANS: Plan[] = [
  {
    id: 'self-host', name: '직접 설치', price: '무료', priceNote: 'MIT 라이선스',
    summary: '조직의 서버에 설치하고 목표와 업무 데이터를 직접 운영합니다.',
    features: ['개인·조직·상업적 사용 가능', '목표·OKR과 다섯 가지 뷰', '인프라와 운영 비용은 별도', '설치·설정은 저장소 문서 참고'],
    highlighted: true,
    cta: { label: '설치 가이드', href: INSTALL_GUIDE_URL },
  },
  {
    id: 'customize', name: '직접 확장', price: '자유롭게', priceNote: '수정·재사용',
    summary: '팀의 업무 방식에 맞게 코드를 고치고 다른 제품에도 활용할 수 있습니다.',
    features: ['소스 코드 공개', '수정·배포·상업적 재사용 가능', '저작권·라이선스 고지 유지', '외부 연동은 운영자가 선택·설정'],
    cta: { label: 'GitHub에서 코드 보기', href: REPOSITORY_URL },
  },
  {
    id: 'consulting', name: 'ALEXSOFT와 함께', price: '별도 협의', priceNote: '설계·개발 용역',
    summary: '설치, 업무 맞춤 기능, 기존 시스템 연동이 필요하면 범위를 정해 함께 만듭니다.',
    features: ['제품·업무 흐름 설계', 'UI·UX 설계와 개발', '시스템 연동·데이터 이관', '일정·비용·지원 범위는 별도 계약'],
    cta: { label: 'ALEXSOFT 상담', href: CONSULTING_URL },
  },
];

export const OPEN_SOURCE_NOTICE = 'Mokpyo는 MIT 라이선스의 오픈소스입니다. 소프트웨어는 무료이며, 서버·외부 서비스 비용과 별도 용역 비용은 운영 방식에 따라 발생합니다.';
