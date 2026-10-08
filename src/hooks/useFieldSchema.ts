import { useQuery } from '@tanstack/react-query';
import { fieldsApi } from '@/lib/api/fields';
import { queryKeys } from '@/lib/queryKeys';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { FieldSchema } from '@/types/fields';

/** 현재 프로젝트의 상태 라벨(org) + 커스텀 필드 정의(project). 목표 목록과 클라이언트 조인. */
export function useFieldSchema() {
  const { currentProject } = useProject();
  const { currentOrganization } = useWorkspace();
  const orgId = currentOrganization?.id ?? null;
  const projectId = currentProject?.id ?? null;

  return useQuery<FieldSchema>({
    queryKey: queryKeys.fieldSchema(orgId, projectId),
    queryFn: () => fieldsApi.getFieldSchema(projectId as string),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
