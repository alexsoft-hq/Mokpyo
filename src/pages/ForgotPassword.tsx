import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';
import { AuthLayout, AuthAlert } from '@/components/auth/AuthLayout';
import { api } from '@/lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || '비밀번호 재설정 요청에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="메일을 확인해주세요"
        description={
          <>
            <strong className="font-medium text-foreground">{email}</strong>이 가입된 주소라면 재설정 링크를 보냈습니다. 링크는 60분 동안 유효합니다.
          </>
        }
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            로그인으로 돌아가기
          </Link>
        }
      >
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            메일이 보이지 않으면 스팸함을 확인해주세요. 몇 분이 지나도 오지 않으면 주소를 다시 확인하고 재요청할 수 있습니다.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11 w-full"
          onClick={() => setSent(false)}
        >
          다른 주소로 다시 요청
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="비밀번호 찾기"
      description="가입한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          로그인으로 돌아가기
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              전송 중...
            </>
          ) : (
            '재설정 링크 받기'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
