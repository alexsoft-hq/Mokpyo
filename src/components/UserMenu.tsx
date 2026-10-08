import { useState } from 'react';
import { LogOut, User, KeyRound, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProfileDialog } from '@/components/ProfileDialog';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { api } from '@/lib/api';

// Default avatar definitions
export const DEFAULT_AVATARS = [
  { id: '1', emoji: '😀', bg: '#FBBF24' },
  { id: '2', emoji: '😎', bg: '#60A5FA' },
  { id: '3', emoji: '🚀', bg: '#34D399' },
  { id: '4', emoji: '🌟', bg: '#F472B6' },
  { id: '5', emoji: '🎯', bg: '#A78BFA' },
  { id: '6', emoji: '🦊', bg: '#FB923C' },
  { id: '7', emoji: '🐱', bg: '#F87171' },
  { id: '8', emoji: '🐶', bg: '#38BDF8' },
  { id: '9', emoji: '🌈', bg: '#4ADE80' },
  { id: '10', emoji: '💡', bg: '#FACC15' },
  { id: '11', emoji: '🎨', bg: '#E879F9' },
  { id: '12', emoji: '🏔️', bg: '#94A3B8' },
];

export function getAvatarInfo(picture?: string | null) {
  if (!picture) return null;

  if (picture.startsWith('default:')) {
    const id = picture.replace('default:', '');
    const avatar = DEFAULT_AVATARS.find(a => a.id === id);
    return avatar ? { type: 'default' as const, ...avatar } : null;
  }

  if (picture.startsWith('upload:')) {
    const fileName = picture.replace('upload:', '');
    return { type: 'upload' as const, url: api.getProfilePictureUrl(fileName) };
  }

  // Legacy: direct URL (e.g., Google OAuth picture)
  if (picture.startsWith('http')) {
    return { type: 'url' as const, url: picture };
  }

  return null;
}

interface UserMenuProps {
  user: {
    userId: string;
    email: string;
    name: string;
    picture?: string;
    hasPassword?: boolean;
  };
  onLogout: () => void;
  /** 메뉴 상단(프로필 항목 위)에 끼워 넣을 추가 항목 — 모바일 워크스페이스 전환 등. */
  extraItems?: React.ReactNode;
  onUserUpdate: (user: { userId: string; email: string; name: string; picture?: string }) => void;
  /** 개인 설정 다이얼로그 열기. 제공 시 계정 메뉴에 '설정' 항목 노출. */
  onSettingsClick?: () => void;
}

export function UserMenu({ user, onLogout, onUserUpdate, onSettingsClick, extraItems }: UserMenuProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  const avatarInfo = getAvatarInfo(user.picture);
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <Avatar className="h-8 w-8 cursor-pointer">
              {avatarInfo?.type === 'upload' || avatarInfo?.type === 'url' ? (
                <AvatarImage src={avatarInfo.url} alt={user.name} />
              ) : null}
              <AvatarFallback
                style={avatarInfo?.type === 'default' ? { backgroundColor: avatarInfo.bg } : undefined}
                className="text-sm"
              >
                {avatarInfo?.type === 'default' ? avatarInfo.emoji : initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {extraItems}
          <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
            <User className="mr-2 h-4 w-4" />
            프로필 편집
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsPasswordOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            비밀번호 변경
          </DropdownMenuItem>
          {onSettingsClick && (
            <DropdownMenuItem onClick={onSettingsClick}>
              <Settings className="mr-2 h-4 w-4" />
              설정
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onUserUpdate={onUserUpdate}
        onAccountDeleted={onLogout}
        hasPassword={user.hasPassword ?? true}
      />

      <ChangePasswordDialog
        open={isPasswordOpen}
        onClose={() => setIsPasswordOpen(false)}
      />
    </>
  );
}
