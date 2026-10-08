import { useTranslation, t } from '@/i18n';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { api, OrganizationMember, PendingInvitation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, Crown, Shield, User, UserPlus, Trash2, Mail, Loader2, AlertTriangle, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import MemberInviteDialog from '@/components/MemberInviteDialog';
import { PlanUsageCard } from '@/components/workspace/PlanUsageCard';
import { DataExportCard } from '@/components/workspace/DataExportCard';

const ROLE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  OWNER: { label: '소유자', icon: <Crown className="h-3 w-3" />, color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  ADMIN: { label: '관리자', icon: <Shield className="h-3 w-3" />, color: 'bg-primary/15 text-primary' },
  MEMBER: { label: '멤버', icon: <User className="h-3 w-3" />, color: 'bg-muted text-muted-foreground' },
};

export default function WorkspaceSettings() {
  useTranslation();
  const { currentOrganization, refreshOrganizations } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [orgName, setOrgName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const currentMember = members.find(m => m.userId === user?.userId);
  const isAdmin = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';
  const isOwner = currentMember?.role === 'OWNER';
  const ownerCount = members.filter(m => m.role === 'OWNER').length;
  // 마지막 소유자는 나갈 수 없음(백엔드도 400으로 차단) → 다른 소유자가 있거나 소유자가 아닐 때만
  const canLeave = !!currentMember && (!isOwner || ownerCount > 1);

  useEffect(() => {
    if (currentOrganization) {
      setOrgName(currentOrganization.name);
      loadMembers();
      if (isAdmin) loadInvitations();
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (isAdmin && currentOrganization) loadInvitations();
  }, [isAdmin]);

  const loadMembers = async () => {
    if (!currentOrganization) return;
    try {
      const data = await api.getOrganizationMembers(currentOrganization.id);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const loadInvitations = async () => {
    if (!currentOrganization) return;
    try {
      const data = await api.getPendingInvitations(currentOrganization.id);
      setPendingInvitations(data);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleSaveName = async () => {
    if (!currentOrganization || !orgName.trim()) return;
    setIsSaving(true);
    try {
      await api.updateOrganization(currentOrganization.id, { name: orgName.trim() });
      await refreshOrganizations();
      toast({ title: t("워크스페이스 이름이 변경되었습니다.") });
    } catch (error: any) {
      toast({ title: t("오류"), description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!currentOrganization) return;
    try {
      await api.updateMemberRole(currentOrganization.id, userId, newRole);
      await loadMembers();
      toast({ title: t("역할이 변경되었습니다.") });
    } catch (error: any) {
      toast({ title: t("오류"), description: error.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!currentOrganization) return;
    if (!confirm(t("{{value0}}님을 워크스페이스에서 제거하시겠습니까?", { value0: memberName }))) return;
    try {
      await api.removeMember(currentOrganization.id, userId);
      await loadMembers();
      toast({ title: t("{{value0}}님이 제거되었습니다.", { value0: memberName }) });
    } catch (error: any) {
      toast({ title: t("오류"), description: error.message, variant: 'destructive' });
    }
  };

  const handleLeave = async () => {
    if (!currentOrganization) return;
    try {
      await api.leaveOrganization(currentOrganization.id);
      await refreshOrganizations();
      setLeaveConfirmOpen(false);
      toast({ title: t("워크스페이스에서 나갔습니다.") });
      navigate('/');
    } catch (error: any) {
      toast({ title: t("오류"), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentOrganization || deleteConfirmName !== currentOrganization.name) return;
    setIsDeleting(true);
    try {
      await api.deleteOrganization(currentOrganization.id);
      await refreshOrganizations();
      setDeleteConfirmOpen(false);
      toast({ title: t("워크스페이스가 삭제되었습니다.") });
      navigate('/');
    } catch (error: any) {
      toast({ title: t("오류"), description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelInvitation = async (id: string) => {
    try {
      await api.cancelInvitation(id);
      await loadInvitations();
      toast({ title: t("초대가 취소되었습니다.") });
    } catch (error: any) {
      toast({ title: t("오류"), description: error.message, variant: 'destructive' });
    }
  };

  if (!currentOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />{t("대시보드로 돌아가기")}</Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("워크스페이스 설정")}</h1>
            <p className="text-sm text-muted-foreground">{currentOrganization.name}</p>
          </div>
        </div>

        {/* Workspace Name */}
        {isAdmin && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t("기본 정보")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">{t("워크스페이스 이름")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={isSaving || orgName === currentOrganization.name}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("저장")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("멤버 (")}{members.length})</CardTitle>
              <CardDescription>{t("워크스페이스 멤버를 관리합니다.")}</CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />{t("초대")}</Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {member.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{member.name}</span>
                        {member.userId === user?.userId && (
                          <Badge variant="outline" className="text-xs">{t("나")}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner && member.userId !== user?.userId ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.userId, value)}
                      >
                        <SelectTrigger className="w-[110px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OWNER">{t("소유자")}</SelectItem>
                          <SelectItem value="ADMIN">{t("관리자")}</SelectItem>
                          <SelectItem value="MEMBER">{t("멤버")}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`${ROLE_LABELS[member.role]?.color} flex items-center gap-1`}>
                        {ROLE_LABELS[member.role]?.icon}
                        {t(ROLE_LABELS[member.role]?.label ?? "")}
                      </Badge>
                    )}
                    {isAdmin && member.userId !== user?.userId && member.role !== 'OWNER' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(member.userId, member.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {isAdmin && pendingInvitations.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t("대기 중인 초대 (")}{pendingInvitations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium">{inv.email}</span>
                        <div className="text-xs text-muted-foreground">
                          {inv.invitedBy}{t("님이 초대 ·")}{t(ROLE_LABELS[inv.role]?.label ?? "")}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvitation(inv.id)}
                    >{t("취소")}</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan & usage / data export — ADMIN 이상 */}
        {isAdmin && <PlanUsageCard orgId={currentOrganization.id} isOwner={isOwner} />}
        {isAdmin && <DataExportCard orgId={currentOrganization.id} />}

        {/* Leave workspace */}
        {canLeave && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LogOut className="h-5 w-5" />{t("워크스페이스 나가기")}</CardTitle>
              <CardDescription>{t("이 워크스페이스에서 나갑니다. 다시 참여하려면 관리자의 초대가 필요합니다.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setLeaveConfirmOpen(true)}>
                <LogOut className="mr-2 h-4 w-4" />{t("나가기")}</Button>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone - OWNER only */}
        {isOwner && (
          <Card className="mb-6 border-destructive/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />{t("위험 구역")}</CardTitle>
              <CardDescription>{t("워크스페이스를 삭제하면 모든 프로젝트, 목표, 데이터가 영구적으로 삭제됩니다.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteConfirmName('');
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />{t("워크스페이스 삭제")}</Button>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("워크스페이스 삭제")}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>
                    <strong className="text-destructive">"{currentOrganization.name}"</strong>{t("워크스페이스를 삭제하시겠습니까?")}</p>
                  <p className="text-destructive font-medium">{t("이 워크스페이스의 모든 프로젝트, 목표, 멤버 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.")}</p>
                  <div className="space-y-2">
                    <Label htmlFor="deleteConfirmName">{t("확인을 위해 워크스페이스 이름을 입력하세요")}</Label>
                    <Input
                      id="deleteConfirmName"
                      value={deleteConfirmName}
                      onChange={(e) => setDeleteConfirmName(e.target.value)}
                      placeholder={currentOrganization.name}
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{t("취소")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteWorkspace}
                disabled={isDeleting || deleteConfirmName !== currentOrganization.name}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? t("삭제 중...") : t("영구 삭제")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("워크스페이스 나가기")}</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>"{currentOrganization.name}"</strong>{t("워크스페이스에서 나가시겠습니까? 다시 참여하려면 관리자의 초대가 필요합니다.")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("취소")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleLeave}>{t("나가기")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <MemberInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          organizationId={currentOrganization.id}
          onInvited={() => {
            loadInvitations();
          }}
        />
      </div>
    </div>
  );
}
