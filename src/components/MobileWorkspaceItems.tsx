import { Link } from 'react-router-dom';
import { Building2, Check, Settings } from 'lucide-react';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * 모바일(sm 미만)에서만 계정 메뉴 안에 들어가는 워크스페이스 전환 항목.
 * 데스크톱은 헤더의 WorkspaceSelector 가 담당하므로 sm 이상에서는 숨긴다.
 */
export function MobileWorkspaceItems() {
  const { organizations, currentOrganization, setCurrentOrganization } = useWorkspace();
  if (!currentOrganization) return null;
  return (
    <DropdownMenuGroup className="sm:hidden">
      <DropdownMenuLabel className="text-xs text-muted-foreground">워크스페이스</DropdownMenuLabel>
      {organizations.map((org) => (
        <DropdownMenuItem key={org.id} onClick={() => setCurrentOrganization(org)}>
          <Building2 className="mr-2 h-4 w-4" />
          <span className="truncate">{org.name}</span>
          {org.id === currentOrganization.id && <Check className="ml-auto h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem asChild>
        <Link to="/workspace/settings">
          <Settings className="mr-2 h-4 w-4" />
          워크스페이스 설정
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </DropdownMenuGroup>
  );
}
