import { Project } from '../types/goal';

/**
 * 평면 배열의 프로젝트를 트리 구조로 변환
 * @param projects 모든 프로젝트 배열
 * @returns 루트 프로젝트들의 배열 (각 프로젝트는 children 속성을 가짐)
 */
export function buildProjectTree(projects: Project[]): Project[] {
  // 프로젝트 ID로 빠른 조회를 위한 맵 생성
  const projectMap = new Map<string, Project>();

  // 각 프로젝트를 복사하여 children 배열 초기화
  const projectsCopy = projects.map(project => ({
    ...project,
    children: [] as Project[]
  }));

  // 맵에 추가
  projectsCopy.forEach(project => {
    projectMap.set(project.id, project);
  });

  // 루트 프로젝트와 자식 프로젝트 분리
  const rootProjects: Project[] = [];

  projectsCopy.forEach(project => {
    if (project.parentId) {
      // 부모가 있으면 부모의 children에 추가
      const parent = projectMap.get(project.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(project);
      } else {
        // 부모를 찾을 수 없으면 루트로 처리 (데이터 무결성 보호)
        rootProjects.push(project);
      }
    } else {
      // 부모가 없으면 루트 프로젝트
      rootProjects.push(project);
    }
  });

  return rootProjects;
}

/**
 * 특정 프로젝트와 모든 하위 프로젝트의 ID를 재귀적으로 수집
 * @param project 대상 프로젝트
 * @returns 프로젝트 자신의 ID와 모든 하위 프로젝트 ID 배열
 */
export function getProjectAndDescendantIds(project: Project): string[] {
  const ids = [project.id];

  if (project.children && project.children.length > 0) {
    project.children.forEach(child => {
      ids.push(...getProjectAndDescendantIds(child));
    });
  }

  return ids;
}

/**
 * 특정 프로젝트까지의 경로를 반환 (breadcrumb용)
 * @param projects 모든 프로젝트 배열
 * @param projectId 대상 프로젝트 ID
 * @returns 루트부터 대상 프로젝트까지의 경로 배열
 */
export function getProjectPath(projects: Project[], projectId: string): Project[] {
  const projectMap = new Map<string, Project>();
  projects.forEach(project => {
    projectMap.set(project.id, project);
  });

  const path: Project[] = [];
  let currentProject = projectMap.get(projectId);

  while (currentProject) {
    path.unshift(currentProject); // 앞에 추가하여 루트부터 순서대로
    if (currentProject.parentId) {
      currentProject = projectMap.get(currentProject.parentId);
    } else {
      currentProject = undefined;
    }
  }

  return path;
}

/**
 * 트리 구조에서 특정 프로젝트를 재귀적으로 찾기
 * @param projects 트리 구조의 프로젝트 배열 (루트들)
 * @param projectId 찾을 프로젝트 ID
 * @returns 찾은 프로젝트 또는 null
 */
export function findProjectInTree(projects: Project[], projectId: string): Project | null {
  for (const project of projects) {
    if (project.id === projectId) {
      return project;
    }

    if (project.children && project.children.length > 0) {
      const found = findProjectInTree(project.children, projectId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * 프로젝트 트리를 평면 배열로 변환 (DFS 순서)
 * @param projects 트리 구조의 프로젝트 배열
 * @param depth 현재 깊이 (선택적, UI에서 들여쓰기에 사용)
 * @returns 평면화된 프로젝트 배열
 */
export function flattenProjectTree(projects: Project[], depth: number = 0): Array<Project & { depth: number }> {
  const result: Array<Project & { depth: number }> = [];

  projects.forEach(project => {
    result.push({ ...project, depth });

    if (project.children && project.children.length > 0) {
      result.push(...flattenProjectTree(project.children, depth + 1));
    }
  });

  return result;
}
