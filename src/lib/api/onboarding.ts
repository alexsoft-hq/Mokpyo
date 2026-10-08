// 온보딩(빈 상태에서 샘플 데이터 불러오기) API.
// src/lib/api.ts 는 건드리지 않고 별도 모듈로 둔다.

import { API_BASE_URL, getAuthHeaders, throwApiError } from '@/lib/api/http';

export interface SampleDataResult {
  /** 샘플 목표가 들어 있는 프로젝트 id */
  projectId: string;
  /** 이번 호출로 새로 만들어졌는지(false 면 이미 있던 샘플 프로젝트) */
  created: boolean;
  /** 샘플 목표 개수 */
  goals?: number;
}

/** 워크스페이스에 둘러보기용 샘플 프로젝트·목표를 만든다(이미 있으면 그 프로젝트를 돌려준다). */
export async function loadSampleData(orgId: string): Promise<SampleDataResult> {
  const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/sample-data`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) await throwApiError(response, '샘플 데이터를 불러오지 못했습니다.');
  return response.json();
}
