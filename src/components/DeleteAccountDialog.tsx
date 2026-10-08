import { t, useTranslation } from '@/i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { deleteAccount } from '@/lib/api/account';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  /** Google 전용 계정(비밀번호 없음)이면 이메일 입력으로 확인한다. */
  hasPassword: boolean;
  onDeleted: () => void;
}

/** 계정 영구 삭제 확인. 서버가 유일한 소유자 워크스페이스를 찾으면 409 로 막고 그 이름을 알려준다. */
export function DeleteAccountDialog({ open, onOpenChange, email, hasPassword, onDeleted }: DeleteAccountDialogProps) {
  useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = hasPassword ? secret.length > 0 : secret.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await deleteAccount(hasPassword ? { password: secret } : { confirmEmail: secret });
      toast({
        title: t("계정이 삭제되었습니다"),
        description: result.deletedWorkspaces > 0 ? t("혼자 쓰던 워크스페이스 {{value0}}개도 함께 삭제했습니다.", { value0: result.deletedWorkspaces }) : undefined,
      });
      onOpenChange(false);
      onDeleted();
      navigate('/welcome', { replace: true });
    } catch (e: any) {
      setError(e.message || t("계정 삭제에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); setSecret(''); setError(''); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("계정을 영구 삭제할까요?")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                {t("프로필과 로그인 정보가 즉시 삭제됩니다. 다른 멤버와 함께 쓰는 워크스페이스의 목표·댓글은 남고, 담당자 표시는 이름만 유지됩니다. 혼자 쓰는 워크스페이스는 모든 데이터와 함께 삭제됩니다.")}
              </p>
              <p>{t("다른 멤버가 있는 워크스페이스의 유일한 소유자라면 먼저 소유권을 넘겨야 합니다.")}</p>
              <div className="space-y-2 pt-1">
                <Label htmlFor="delete-account-secret">{hasPassword ? t("확인을 위해 비밀번호를 입력하세요") : t("확인을 위해 이메일({{value0}})을 입력하세요", { value0: email })}</Label>
                <Input
                  id="delete-account-secret"
                  type={hasPassword ? 'password' : 'email'}
                  autoComplete={hasPassword ? 'current-password' : 'off'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  disabled={busy}
                />
              </div>
              {error && <p className="text-destructive">{error}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("취소")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void handleDelete(); }}
            disabled={busy || !canSubmit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("영구 삭제")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
