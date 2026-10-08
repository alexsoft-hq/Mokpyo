import { useEffect } from 'react';

const BASE_TITLE = 'Mokpyo — 팀 목표·OKR 관리';

/**
 * 마케팅·법적 고지 페이지의 문서 제목을 설정한다.
 * react-helmet 을 쓰지 않으므로 마운트 시 직접 바꾸고, 벗어날 때 기본 제목으로 되돌린다.
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Mokpyo` : BASE_TITLE;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
