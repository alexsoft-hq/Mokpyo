import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { RegisteredUser } from '@/components/OwnerInput';

/** 조직 멤버 목록(담당자 자동완성·아바타용). RegisteredUser 형태. */
export function useOrgUsers() {
  const { currentOrganization } = useWorkspace();
  const orgId = currentOrganization?.id ?? null;
  return useQuery<RegisteredUser[]>({
    queryKey: queryKeys.users(orgId),
    queryFn: async () => {
      const users = await api.getUsers();
      return users.map((u) => ({ id: u.id, name: u.name, picture: u.picture }));
    },
    staleTime: 5 * 60_000,
  });
}
