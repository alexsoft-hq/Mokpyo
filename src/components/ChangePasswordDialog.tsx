import { t, useTranslation } from '@/i18n';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { validatePassword, PASSWORD_HINT } from '@/components/auth/password';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t("새 비밀번호가 일치하지 않습니다."));
      return;
    }

    const policyError = validatePassword(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }

    setIsLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(handleClose, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("비밀번호 변경")}</DialogTitle>
          <DialogDescription>{t("현재 비밀번호를 확인한 후 새 비밀번호를 설정합니다.")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t("현재 비밀번호")}</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t("새 비밀번호")}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={PASSWORD_HINT}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("새 비밀번호 확인")}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{t("비밀번호가 변경되었습니다.")}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {t("취소")}
            </Button>
            <Button type="submit" disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}>
              {isLoading ? t("변경 중...") : t("변경")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
