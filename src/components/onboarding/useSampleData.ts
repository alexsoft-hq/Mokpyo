import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { loadSampleData } from '@/lib/api/onboarding';
import { ApiError } from '@/lib/api/http';
import { api } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * 빈 상태의 '샘플 데이터로 둘러보기' 동작.
 * 카드·보드·타임라인이 같은 흐름을 쓰도록 한 곳에 모았다.
 * 백엔드 엔드포인트가 아직 없을 수 있으므로 실패는 토스트로만 알린다.
 */
export function useSampleData() {
  const { currentOrganization } = useWorkspace();
  const { refreshProjects, setCurrentProject } = useProject();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const loadSample = async () => {
    if (!currentOrganization) {
      toast.error('워크스페이스를 먼저 선택하세요.');
      return;
    }
    setLoading(true);
    try {
      const { projectId, created } = await loadSampleData(currentOrganization.id);

      // 새로 생긴 프로젝트를 목록에 반영한 뒤 그 프로젝트로 전환한다.
      const projects = await api.getProjects();
      await refreshProjects();
      const target = projects.find((p) => p.id === projectId);
      if (target) setCurrentProject(target);

      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['fieldSchema'] });

      toast.success(
        created ? '샘플 데이터를 만들었습니다.' : '이미 만들어 둔 샘플 프로젝트로 이동했습니다.'
      );
    } catch (error) {
      // 샘플 생성은 워크스페이스 관리자만 할 수 있다.
      if (error instanceof ApiError && error.status === 403) {
        toast.error('샘플 데이터는 워크스페이스 관리자만 만들 수 있습니다.');
      } else {
        toast.error(error instanceof Error ? error.message : '샘플 데이터를 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return { loadSample, loading };
}
