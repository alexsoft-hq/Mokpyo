import { t, useTranslation } from '@/i18n';
import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Check, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadAccountExport } from '@/lib/api/account';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { api } from '@/lib/api';
import { DEFAULT_AVATARS, getAvatarInfo } from '@/components/UserMenu';

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  user: {
    userId: string;
    email: string;
    name: string;
    picture?: string;
  };
  onUserUpdate: (user: { userId: string; email: string; name: string; picture?: string }) => void;
  /** 계정 삭제 완료 후(세션 정리용). 없으면 삭제 섹션을 숨긴다. */
  onAccountDeleted?: () => void;
  /** 비밀번호 로그인 계정 여부(Google 전용이면 false). 기본 true. */
  hasPassword?: boolean;
}

export function ProfileDialog({ open, onClose, user, onUserUpdate, onAccountDeleted, hasPassword = true }: ProfileDialogProps) {
  useTranslation();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [name, setName] = useState(user.name);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarInfo = getAvatarInfo(user.picture);
  const currentAvatarId = user.picture?.startsWith('default:') ? user.picture.replace('default:', '') : null;

  const handleNameSave = async () => {
    if (!name.trim() || name.trim() === user.name) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await api.updateProfile(name.trim());
      onUserUpdate(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarSelect = async (avatarId: string) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.selectDefaultAvatar(avatarId);
      onUserUpdate(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t("이미지 파일만 업로드할 수 있습니다."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(t("파일 크기는 5MB 이하여야 합니다."));
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await api.uploadProfilePicture(file);
      onUserUpdate(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("프로필 편집")}</DialogTitle>
          <DialogDescription>{t("프로필 사진과 이름을 변경할 수 있습니다.")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {avatarInfo?.type === 'upload' || avatarInfo?.type === 'url' ? (
                  <AvatarImage src={avatarInfo.url} alt={user.name} />
                ) : null}
                <AvatarFallback
                  style={avatarInfo?.type === 'default' ? { backgroundColor: avatarInfo.bg, fontSize: '2rem' } : undefined}
                  className="text-2xl"
                >
                  {avatarInfo?.type === 'default' ? avatarInfo.emoji : initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-primary-foreground shadow-md hover:bg-primary/90"
                disabled={isLoading}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Default Avatar Grid */}
          <div>
            <Label className="text-sm font-medium mb-2 block">{t("기본 아바타 선택")}</Label>
            <div className="grid grid-cols-6 gap-2">
              {DEFAULT_AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => handleAvatarSelect(avatar.id)}
                  disabled={isLoading}
                  className="relative flex items-center justify-center rounded-lg p-2 text-xl transition-all hover:scale-110 hover:shadow-md border-2"
                  style={{
                    backgroundColor: avatar.bg + '30',
                    borderColor: currentAvatarId === avatar.id ? avatar.bg : 'transparent',
                  }}
                >
                  {avatar.emoji}
                  {currentAvatarId === avatar.id && (
                    <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t("이름")}</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("이름을 입력하세요")}
                disabled={isLoading}
              />
              <Button
                onClick={handleNameSave}
                disabled={isLoading || !name.trim() || name.trim() === user.name}
                size="sm"
              >
                {t("저장")}
              </Button>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>{t("이메일")}</Label>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* 내 데이터·계정 */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t("내 데이터 내보내기")}</p>
                <p className="text-xs text-muted-foreground">{t("프로필, 소속 워크스페이스, 담당 목표, 댓글을 JSON 으로 받습니다.")}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await downloadAccountExport();
                  } catch (e: any) {
                    toast({ title: t("내보내기 실패"), description: e.message, variant: 'destructive' });
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {t("내보내기")}
              </Button>
            </div>
            {onAccountDeleted && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("계정 삭제")}</p>
                  <p className="text-xs text-muted-foreground">{t("되돌릴 수 없습니다. 혼자 쓰는 워크스페이스도 함께 삭제됩니다.")}</p>
                </div>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("삭제")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      {onAccountDeleted && (
        <DeleteAccountDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          email={user.email}
          hasPassword={hasPassword}
          onDeleted={() => { onClose(); onAccountDeleted(); }}
        />
      )}
    </Dialog>
  );
}
