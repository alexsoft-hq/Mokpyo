import { t, useTranslation } from '@/i18n';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';

interface MemberInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onInvited: () => void;
}

export default function MemberInviteDialog({
  open,
  onOpenChange,
  organizationId,
  onInvited,
}: MemberInviteDialogProps) {
  useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createInvitation(organizationId, email.trim(), role);
      toast({ title: t("초대가 발송되었습니다."), description: t("{{value0}}으로 초대 이메일을 보냈습니다.", { value0: email }) });
      setEmail('');
      setRole('MEMBER');
      onInvited();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: t("초대 실패"), description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t("멤버 초대")}
          </DialogTitle>
          <DialogDescription>
            {t("이메일 주소를 입력하여 워크스페이스에 멤버를 초대하세요.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("이메일 주소")}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">{t("역할")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">{t("멤버 - 목표 생성/편집 가능")}</SelectItem>
                <SelectItem value="ADMIN">{t("관리자 - 멤버 관리 가능")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("취소")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("초대 보내기")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
