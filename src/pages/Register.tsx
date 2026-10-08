import { useAuthFeedback } from './authFeedback';
import { useTranslation, t } from '@/i18n';
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AuthLayout, AuthAlert, AuthNotice } from "@/components/auth/AuthLayout";
import { PASSWORD_HINT, PASSWORD_POLICY_MESSAGE, validatePassword } from "@/components/auth/password";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, verifyEmail, resendVerification } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError, setLocalError] = useAuthFeedback();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification state
  const redirectTo = searchParams.get('redirect') || '/';
  const initialVerifyEmail = searchParams.get("verify") || "";
  const [step, setStep] = useState<"register" | "verify">(initialVerifyEmail ? "verify" : "register");
  const [verifyEmailAddress, setVerifyEmailAddress] = useState(initialVerifyEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage, setLocalResendMessage] = useAuthFeedback();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setLocalError("비밀번호가 일치하지 않습니다.");
      return;
    }

    const policyError = validatePassword(password);
    if (policyError) {
      setLocalError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(email, password, name);
      if (result.token) {
        navigate(redirectTo, { replace: true });
        return;
      }
      setVerifyEmailAddress(result.email);
      setStep("verify");
    } catch (err: any) {
      if (err.message) setError(err.message);
      else setLocalError("회원가입에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsVerifying(true);

    try {
      await verifyEmail(verifyEmailAddress, verificationCode);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      if (err.message) setError(err.message);
      else setLocalError("인증에 실패했습니다.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResendMessage("");
    setIsResending(true);

    try {
      await resendVerification(verifyEmailAddress);
      setLocalResendMessage("인증 코드를 재발송했습니다.");
    } catch (err: any) {
      if (err.message) setError(err.message);
      else setLocalError("재발송에 실패했습니다.");
    } finally {
      setIsResending(false);
    }
  };

  if (step === "verify") {
    return (
      <AuthLayout
        title={t("이메일 인증")}
        description={
          <>
            {t("{{email}}으로 발송된 6자리 인증 코드를 입력해주세요.", { email: verifyEmailAddress })}</>
        }
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">{t("로그인으로 돌아가기")}</Link>
        }
      >
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verificationCode">{t("인증 코드")}</Label>
            <Input
              id="verificationCode"
              type="text"
              inputMode="numeric"
              placeholder={t("6자리 코드 입력")}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          {error && <AuthAlert>{error}</AuthAlert>}
          {resendMessage && <AuthNotice>{resendMessage}</AuthNotice>}

          <Button type="submit" className="h-11 w-full" disabled={isVerifying || verificationCode.length !== 6}>
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{t("인증 중...")}</>
            ) : (
              t("인증 완료")
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">{t("코드를 받지 못하셨나요?")}{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="font-medium text-primary hover:underline disabled:opacity-50"
          >
            {isResending ? t("발송 중...") : t("재발송")}
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("회원가입")}
      description={t("계정을 만들고 팀의 목표를 한 화면에 모으세요.")}
      footer={
        <>{t("이미 계정이 있으신가요?")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">{t("로그인")}</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("이름")}</Label>
          <Input
            id="name"
            type="text"
            placeholder={t("이름을 입력하세요")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
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
          <Label htmlFor="password">{t("비밀번호")}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t(PASSWORD_HINT)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            {t(PASSWORD_HINT)}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("비밀번호 확인")}</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t("비밀번호를 다시 입력하세요")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <p className="text-xs leading-relaxed text-muted-foreground">{t("가입하면")}{" "}
          <Link to="/terms" className="underline hover:text-foreground">{t("이용약관")}</Link>{t("과")}{" "}
          <Link to="/privacy" className="underline hover:text-foreground">{t("개인정보처리방침")}</Link>{t("에 동의하는 것으로 봅니다.")}</p>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{t("가입 중...")}</>
          ) : (
            t("회원가입")
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
