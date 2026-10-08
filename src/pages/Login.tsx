import { useAuthFeedback } from './authFeedback';
import { useTranslation, t } from '@/i18n';
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AuthLayout, AuthAlert } from "@/components/auth/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithCredentials, authConfig } = useAuth();
  const redirectTo = searchParams.get('redirect') || '/';
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError, setLocalError] = useAuthFeedback(searchParams.get('expired') ? "로그인 세션이 만료되었습니다. 다시 로그인해주세요." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setIsSubmitting(true);

    try {
      await loginWithCredentials(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      if (err.needsVerification) {
        setNeedsVerification(true);
        setVerificationEmail(err.email);
      }
      if (err.message) setError(err.message);
      else setLocalError("로그인에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const registerHref = redirectTo !== '/'
    ? `/register?redirect=${encodeURIComponent(redirectTo)}`
    : '/register';

  return (
    <AuthLayout
      title={t("로그인")}
      description={t("목표와 진행 상황을 이어서 확인하세요.")}
      footer={
        <>{t("계정이 없으신가요?")}{" "}
          <Link to={registerHref} className="font-medium text-primary hover:underline">{t("회원가입")}</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("이메일")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("비밀번호")}</Label>
            <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground hover:underline">{t("비밀번호를 잊으셨나요?")}</Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder={t("비밀번호를 입력하세요")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <AuthAlert>
            {error}
            {needsVerification && (
              <div className="mt-2">
                <Link
                  to={`/register?verify=${encodeURIComponent(verificationEmail)}`}
                  className="font-medium underline"
                >{t("인증 코드 입력하기")}</Link>
              </div>
            )}
          </AuthAlert>
        )}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{t("로그인 중...")}</>
          ) : (
            t("로그인")
          )}
        </Button>
      </form>

      {authConfig?.oauthEnabled && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">{t("또는")}</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            className="h-11 w-full"
            variant="outline"
          >
            <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>{t("Google로 로그인")}</Button>
        </>
      )}
    </AuthLayout>
  );
}
