// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import Pricing from './Pricing';
import Terms from '@/pages/legal/Terms';
import Privacy from '@/pages/legal/Privacy';
import { CONSULTING_URL, INSTALL_GUIDE_URL, LICENSE_URL, REPOSITORY_URL } from '@/components/marketing/projectLinks';

beforeAll(() => {
  // jsdom 에 없는 API — MarketingLayout 의 해시 스크롤이 호출한다.
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = (() => {}) as typeof window.scrollTo;
});

function renderAt(ui: React.ReactElement, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe('마케팅 페이지', () => {
  it('랜딩은 가치 제안과 두 CTA, 5개 뷰를 모두 보여준다', () => {
    renderAt(<Landing />, '/welcome');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('팀의 목표를 한 화면에서.');
    // 히어로 + 마지막 CTA 밴드에 각각 하나씩
    expect(screen.getAllByRole('link', { name: '설치 가이드' }).length).toBeGreaterThanOrEqual(2);
    for (const link of screen.getAllByRole('link', { name: '설치 가이드' })) {
      expect(link).toHaveAttribute('href', INSTALL_GUIDE_URL);
    }
    expect(screen.getByRole('link', { name: '이 서버에 가입' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', REPOSITORY_URL);
    expect(screen.queryByText('무료로 시작하기')).not.toBeInTheDocument();

    for (const view of ['카드', '테이블', '보드', '타임라인', '대시보드']) {
      expect(screen.getAllByRole('heading', { name: view }).length).toBeGreaterThan(0);
    }
  });

  it('랜딩의 FAQ 답변은 details 를 펼치기 전에도 DOM 에 존재한다', () => {
    renderAt(<Landing />, '/welcome');
    expect(screen.getByText(/하위 목표가 있으면 하위 진행률이 상위로 올라옵니다/)).toBeInTheDocument();
  });

  it('기존 요금제 경로는 무료 소프트웨어와 별도 용역을 구분한다', () => {
    renderAt(<Pricing />, '/pricing');
    for (const option of ['직접 설치', '직접 확장', 'ALEXSOFT와 함께']) {
      expect(screen.getByRole('heading', { name: option })).toBeInTheDocument();
    }
    expect(screen.getByText(/Mokpyo는 MIT 라이선스의 오픈소스입니다/)).toBeInTheDocument();
    expect(screen.getByText(/일정·비용·지원 범위는 별도 계약/)).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'ALEXSOFT 상담' })) {
      expect(link).toHaveAttribute('href', CONSULTING_URL);
    }
    expect(screen.queryByText(/1인 \/ 월|베타 기간|정식 출시 후 결제/)).not.toBeInTheDocument();
  });

  it('라이선스 안내와 운영자별 개인정보 방침을 명확히 구분한다', () => {
    const terms = renderAt(<Terms />, '/terms');
    expect(screen.getByRole('note')).toHaveTextContent('특정 서버의 서비스 이용약관을 대신하지 않습니다');
    expect(screen.getByRole('link', { name: 'MIT 라이선스 원문' })).toHaveAttribute('href', LICENSE_URL);
    expect(screen.queryByText('[회사명]')).not.toBeInTheDocument();
    terms.unmount();

    renderAt(<Privacy />, '/privacy');
    expect(screen.getByRole('note')).toHaveTextContent('운영자의 확정된 개인정보처리방침이 아닙니다');
    expect(screen.getByText(/Azure OpenAI 엔드포인트로 전송/)).toBeInTheDocument();
    expect(screen.queryByText('[호스팅 업체]')).not.toBeInTheDocument();
  });

  it('마케팅 레이아웃의 푸터는 이용약관·개인정보처리방침으로 연결된다', () => {
    renderAt(<Landing />, '/welcome');
    expect(screen.getByRole('link', { name: '라이선스·이용 안내' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '개인정보 처리 안내' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'contact@alexsoft.co.kr' })).toHaveAttribute('href', 'mailto:contact@alexsoft.co.kr');
  });
});
