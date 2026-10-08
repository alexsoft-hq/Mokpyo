import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { api, InvitationInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, CircleCheck } from 'lucide-react';
import { AuthLayout, AuthAlert } from '@/components/auth/AuthLayout';

export default function InviteAccept() {
  const { token: inviteToken } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { refreshOrganizations, setCurrentOrganization } = useWorkspace();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    loadInvitation();
  }, [inviteToken]);

  const loadInvitation = async () => {
    try {
      const data = await api.getInvitation(inviteToken!);
      setInvitation(data);
    } catch (err: any) {
      setError(err.message || '초대를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!inviteToken) return;
    setIsAccepting(true);
    setError('');

    try {
      const result = await api.acceptInvitation(inviteToken);
      setAccepted(true);

      // Refresh organizations and switch to the new one
      await refreshOrganizations();
      const orgs = await api.getOrganizations();
      const targetOrg = orgs.find(o => o.id === result.organizationId);
      if (targetOrg) {
        setCurrentOrganization(targetOrg);
      }

      // Redirect to dashboard after short delay
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      setError(err.message || '초대 수락에 실패했습니다.');
    } finally {
      setIsAccepting(false);
    }
  };

  const inviteDescription = invitation ? (
    <>
      <strong className="font-medium text-foreground">{invitation.invitedBy}</strong>님이{' '}
      <strong className="font-medium text-foreground">{invitation.organization.name}</strong> 워크스페이스에 초대했습니다.
    </>
  ) : null;

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="불러오는 중" />
      </div>
    );
  }

  // Not logged in - redirect to login with return URL
  if (!isAuthenticated) {
    return (
      <AuthLayout
        title="워크스페이스 초대"
        description={inviteDescription ?? (error || '초대 정보를 불러오는 중입니다.')}
      >
        <div className="space-y-3">
          <Button className="h-11 w-full" onClick={() => navigate(`/login?redirect=/invite/${inviteToken}`)}>
            로그인하고 초대 수락
          </Button>
          <Button variant="outline" className="h-11 w-full" onClick={() => navigate(`/register?redirect=/invite/${inviteToken}`)}>
            회원가입하고 초대 수락
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (accepted) {
    return (
      <AuthLayout
        title="초대를 수락했습니다"
        description={`${invitation?.organization.name ?? '워크스페이스'}로 이동합니다.`}
      >
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
          <CircleCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">잠시만 기다려주세요.</span>
        </div>
      </AuthLayout>
    );
  }

  if (error && !invitation) {
    return (
      <AuthLayout title="초대를 확인할 수 없습니다" description={error}>
        <Button className="h-11 w-full" onClick={() => navigate('/')}>
          대시보드로 이동
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="워크스페이스 초대" description={inviteDescription}>
      <div className="space-y-3">
        {error && <AuthAlert>{error}</AuthAlert>}
        <Button className="h-11 w-full" onClick={handleAccept} disabled={isAccepting}>
          {isAccepting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              수락 중...
            </>
          ) : (
            '초대 수락'
          )}
        </Button>
        <Button variant="outline" className="h-11 w-full" onClick={() => navigate('/')}>
          나중에 하기
        </Button>
      </div>
    </AuthLayout>
  );
}
