import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL, CONSULTING_URL, REPOSITORY_URL } from './projectLinks';
import { cn } from '@/lib/utils';

interface MarketingLayoutProps {
  children: React.ReactNode;
  /** 본문 최대 폭 클래스. 문서형 페이지는 max-w-3xl 을 넘긴다. */
  className?: string;
}

/**
 * 비로그인 방문자용 공통 껍데기 — 상단 내비 + 본문 + 푸터.
 * 색은 전부 토큰이라 다크 모드에서도 그대로 동작한다.
 */
export function MarketingLayout({ children, className }: MarketingLayoutProps) {
  useHashScroll();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 h-14 flex items-center gap-4">
          <Link to="/welcome" aria-label="Mokpyo 홈" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
            <Logo size={24} />
          </Link>

          <nav aria-label="주요 메뉴" className="hidden md:flex items-center gap-6 ml-4 text-sm">
            <Link to="/welcome#features" className="text-muted-foreground hover:text-foreground transition-colors">
              기능
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              도입과 지원
            </Link>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">로그인</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">이 서버에 가입</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className={cn('flex-1', className)}>{children}</main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-12 md:py-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <Logo size={24} />
              <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
                ALEXSOFT가 만든 MIT 오픈소스 목표·OKR 도구입니다. 조직의 환경에 맞게 설치하고 수정할 수 있습니다.
              </p>
            </div>

            <FooterColumn title="제품">
              <FooterLink to="/welcome#features">기능</FooterLink>
              <FooterLink to="/pricing">도입과 지원</FooterLink>
            </FooterColumn>

            <FooterColumn title="소스와 지원">
              <li><a href={REPOSITORY_URL} className="text-muted-foreground hover:text-foreground">GitHub</a></li>
              <li><a href={CONSULTING_URL} className="text-muted-foreground hover:text-foreground">ALEXSOFT 상담</a></li>
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {CONTACT_EMAIL}
                </a>
              </li>
            </FooterColumn>

            <FooterColumn title="법적 고지">
              <FooterLink to="/terms">라이선스·이용 안내</FooterLink>
              <FooterLink to="/privacy">개인정보 처리 안내</FooterLink>
            </FooterColumn>
          </div>

          <div className="mt-10 pt-6 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <LogoMark size={16} />
            <span>© 2026 ALEXSOFT · Mokpyo · MIT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * react-router 의 Link 는 해시가 있어도 스크롤을 옮기지 않는다.
 * /pricing 에서 "기능"을 눌러 /welcome#features 로 올 때도 해당 섹션으로 가도록 직접 맞춘다.
 */
function useHashScroll() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pathname, hash]);
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-muted-foreground hover:text-foreground transition-colors">
        {children}
      </Link>
    </li>
  );
}

export default MarketingLayout;
