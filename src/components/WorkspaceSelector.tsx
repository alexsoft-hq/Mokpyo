import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, Plus, Settings } from 'lucide-react';

export default function WorkspaceSelector() {
  const { organizations, currentOrganization, setCurrentOrganization } = useWorkspace();
  const navigate = useNavigate();

  if (!currentOrganization) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2 h-8">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="hidden sm:inline text-sm font-medium max-w-[150px] truncate">
            {currentOrganization.name}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => {
              setCurrentOrganization(org);
              // Force reload to refresh data with new org context
              window.location.reload();
            }}
            className={org.id === currentOrganization.id ? 'bg-accent' : ''}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="truncate">{org.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {org.memberCount}명
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/workspace/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          워크스페이스 설정
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/workspace/new')}>
          <Plus className="mr-2 h-4 w-4" />
          새 워크스페이스 만들기
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
