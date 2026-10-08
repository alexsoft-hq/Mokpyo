import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CircleCheck } from 'lucide-react';
import { AuthLayout, AuthAlert } from '@/components/auth/AuthLayout';
import { PASSWORD_HINT, validatePassword } from '@/components/auth/password';
import { api } from '@/lib/api';

type TokenState = 'checking' | 'valid' | 'invalid';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [tokenState, setTokenState] = useState<TokenState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setTokenState('invalid');
      return;
    }

    api
      .validateResetToken(token)
      .then((result) => {
        if (!cancelled) setTokenState(result.valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (!cancelled) setTokenState('invalid');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || '비밀번호 재설정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tokenState === 'checking') {
    return (
      <AuthLayout title="비밀번호 재설정" description="링크를 확인하는 중입니다.">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="확인 중" />
        </div>
      </AuthLayout>
    );
  }

  if (tokenState === 'invalid') {
    return (
      <AuthLayout
        title="링크를 사용할 수 없습니다"
        description="링크가 만료되었거나 올바르지 않습니다. 재설정 링크는 60분 동안만 유효합니다."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        }
      >
        <Button asChild className="h-11 w-full">
          <Link to="/forgot-password">다시 요청하기</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="비밀번호를 변경했습니다"
        description="새 비밀번호로 로그인해주세요."
      >
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            다른 기기에서도 새 비밀번호를 사용하세요. 이전 재설정 링크는 더 이상 쓸 수 없습니다.
          </p>
        </div>
        <Button asChild className="h-11 w-full">
          <Link to="/login">로그인</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="새 비밀번호 설정"
      description="앞으로 사용할 비밀번호를 입력해주세요."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          로그인으로 돌아가기
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">새 비밀번호</Label>
          <Input
            id="password"
            type="password"
            placeholder={PASSWORD_HINT}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="password-hint"
            autoFocus
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            {PASSWORD_HINT}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              변경 중...
            </>
          ) : (
            '비밀번호 변경'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
