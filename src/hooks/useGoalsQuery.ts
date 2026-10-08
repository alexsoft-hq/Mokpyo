import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys, GoalsQueryParams } from '@/lib/queryKeys';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Goal } from '@/types/goal';

/**
 * Shared goals query for the new views (table/board/dashboard).
 * Scoped to the current org + project so switching either isolates the cache.
 *
 * `editing` pauses background refetch while an inline edit is open — mirrors the
 * polling guard the legacy Index page uses (it pauses polling while a dialog is
 * open). `refetchInterval` also self-suppresses when the tab is hidden.
 */
export function useGoalsQuery(
  params: GoalsQueryParams = {},
  options: { enabled?: boolean; refetchIntervalMs?: number; editing?: boolean } = {}
) {
  const { currentProject } = useProject();
  const { currentOrganization } = useWorkspace();
  const orgId = currentOrganization?.id ?? null;
  const projectId = currentProject?.id ?? null;

  const {
    showCompleted = false,
    includeDescendants = false,
    showOnHold = true,
    lightweight = false,
    completedDateFrom,
    completedDateTo,
  } = params;

  return useQuery<Goal[]>({
    queryKey: queryKeys.goals(orgId, projectId, params),
    queryFn: () =>
      api.getGoals(
        projectId as string,
        showCompleted,
        includeDescendants,
        showOnHold,
        lightweight,
        completedDateFrom,
        completedDateTo
      ),
    enabled: !!projectId && (options.enabled ?? true),
    refetchInterval: () => {
      if (options.editing) return false;
      if (typeof document !== 'undefined' && document.hidden) return false;
      return options.refetchIntervalMs ?? false;
    },
    refetchIntervalInBackground: false,
  });
}
