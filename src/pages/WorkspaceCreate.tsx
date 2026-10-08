import { useAuthFeedback } from './authFeedback';
import { useTranslation, t } from '@/i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { AuthLayout, AuthAlert } from '@/components/auth/AuthLayout';

export default function WorkspaceCreate() {
  useTranslation();
  const { user } = useAuth();
  const { createOrganization } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError, setLocalError] = useAuthFeedback();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      await createOrganization(name.trim());
      navigate('/');
    } catch (err: any) {
      if (err.message) setError(err.message);
      else setLocalError("워크스페이스 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t("워크스페이스 만들기")}
      description={
        user?.name
          ? t("{{value0}}님, 팀이나 프로젝트를 위한 워크스페이스를 만들어주세요.", { value0: user.name })
          : t("팀이나 프로젝트를 위한 워크스페이스를 만들어주세요.")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("워크스페이스 이름")}</Label>
          <Input
            id="name"
            placeholder={t("예: 우리 팀, 내 프로젝트")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">{t("나중에 설정에서 바꿀 수 있습니다.")}</p>
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{t("생성 중...")}</>
          ) : (
            t("워크스페이스 생성")
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
