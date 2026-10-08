import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { t, useTranslation } from '@/i18n';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { LayoutGrid, Target, MessagesSquare } from 'lucide-react';

interface AuthLayoutProps {
  /** 카드 상단 제목. */
  title: string;
  /** 제목 아래 한 줄 설명. */
  description?: ReactNode;
  /** 카드 본문(폼 등). */
  children: ReactNode;
  /** 카드 아래 보조 영역(가입/로그인 전환 링크 등). */
  footer?: ReactNode;
}

const FEATURES = [
  {
    icon: LayoutGrid,
    get text() { return t("카드·테이블·보드·타임라인으로 같은 목표를 다르게 봅니다."); },
  },
  {
    icon: Target,
    get text() { return t("Key Result 체크인만 하면 진행률과 마감이 따라옵니다."); },
  },
  {
    icon: MessagesSquare,
    get text() { return t("댓글과 멘션으로 논의가 목표 안에 남습니다."); },
  },
];

/**
 * 로그인·회원가입·비밀번호 재설정·초대 수락 등 인증 화면의 공통 껍데기.
 * 좌측 브랜드 패널은 lg 이상에서만 보이고, 모바일에서는 폼 위에 로고만 남는다.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  useTranslation();
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* 좌: 브랜드 패널 */}
      <aside className="hidden lg:flex flex-col justify-between border-r border-border bg-muted/40 p-12">
        <Link to="/welcome" className="inline-flex w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Logo size={28} />
        </Link>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-snug tracking-tight text-foreground">
            {t("팀의 목표를 한 화면에서.")}
            <br />
            {t("계획부터 달성까지.")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("카드·테이블·보드·타임라인으로 같은 목표를 다르게 보고, 진행률과 마감은 자동으로 따라갑니다.")}
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" />
      </aside>

      {/* 우: 폼 */}
      <main className="flex flex-col items-center justify-center px-4 py-12 md:px-6">
        <div className="w-full max-w-md">
          <div className="mb-4 flex justify-end"><LanguageSwitcher /></div>
          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/welcome" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Logo size={26} />
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">{title}</h1>
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            )}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}

          <div className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground hover:underline">
              {t("이용약관")}
            </Link>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <Link to="/privacy" className="hover:text-foreground hover:underline">
              {t("개인정보처리방침")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/** 인증 화면 공통 오류 박스. 토큰 색만 쓴다. */
export function AuthAlert({ children }: { children: ReactNode }) {
  useTranslation();
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {children}
    </div>
  );
}

/** 인증 화면 공통 안내 박스(재발송 완료 등). */
export function AuthNotice({ children }: { children: ReactNode }) {
  useTranslation();
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export default AuthLayout;
