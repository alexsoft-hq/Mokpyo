import { describe, it, expect } from 'vitest';
import {
  buildProjectTree,
  getProjectAndDescendantIds,
  getProjectPath,
  findProjectInTree,
  flattenProjectTree,
} from './projectTree';
import { Project } from '../types/goal';

// 테스트용 프로젝트 데이터 생성 헬퍼
function createProject(id: string, name: string, parentId?: string | null): Project {
  return {
    id,
    name,
    dashboardTitle: name,
    dashboardSubtitle: '',
    parentId: parentId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [],
  };
}

describe('projectTree', () => {
  describe('buildProjectTree', () => {
    it('should return empty array for empty input', () => {
      const result = buildProjectTree([]);
      expect(result).toEqual([]);
    });

    it('should handle single root project', () => {
      const projects = [createProject('1', 'Project 1')];
      const result = buildProjectTree(projects);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].children).toEqual([]);
    });

    it('should build two-level tree', () => {
      const projects = [
        createProject('1', 'Parent'),
        createProject('2', 'Child', '1'),
      ];

      const result = buildProjectTree(projects);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].id).toBe('2');
    });

    it('should build three-level deep tree', () => {
      const projects = [
        createProject('1', 'Root'),
        createProject('2', 'Level 1', '1'),
        createProject('3', 'Level 2', '2'),
      ];

      const result = buildProjectTree(projects);

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].children).toHaveLength(1);
      expect(result[0].children![0].children![0].id).toBe('3');
    });

    it('should handle multiple roots with children', () => {
      const projects = [
        createProject('1', 'Root A'),
        createProject('2', 'Root B'),
        createProject('3', 'Child A1', '1'),
        createProject('4', 'Child B1', '2'),
        createProject('5', 'Child A2', '1'),
      ];

      const result = buildProjectTree(projects);

      expect(result).toHaveLength(2);

      const rootA = result.find(p => p.id === '1');
      const rootB = result.find(p => p.id === '2');

      expect(rootA?.children).toHaveLength(2);
      expect(rootB?.children).toHaveLength(1);
    });

    it('should handle orphaned projects as roots', () => {
      const projects = [
        createProject('1', 'Root'),
        createProject('2', 'Orphan', 'non-existent-parent'),
      ];

      const result = buildProjectTree(projects);

      // Orphan should be treated as root due to missing parent
      expect(result).toHaveLength(2);
    });

    it('should not mutate original projects array', () => {
      const projects = [
        createProject('1', 'Parent'),
        createProject('2', 'Child', '1'),
      ];
      const originalIds = projects.map(p => p.id);

      buildProjectTree(projects);

      expect(projects.map(p => p.id)).toEqual(originalIds);
      expect(projects[0].children).toEqual([]); // Original unchanged
    });
  });

  describe('getProjectAndDescendantIds', () => {
    it('should return only self id for project without children', () => {
      const project = createProject('1', 'Solo');
      const ids = getProjectAndDescendantIds(project);

      expect(ids).toEqual(['1']);
    });

    it('should return self and direct children ids', () => {
      const project: Project = {
        ...createProject('1', 'Parent'),
        children: [
          createProject('2', 'Child 1'),
          createProject('3', 'Child 2'),
        ],
      };

      const ids = getProjectAndDescendantIds(project);

      expect(ids).toHaveLength(3);
      expect(ids).toContain('1');
      expect(ids).toContain('2');
      expect(ids).toContain('3');
    });

    it('should recursively collect deep descendants', () => {
      const project: Project = {
        ...createProject('1', 'Root'),
        children: [
          {
            ...createProject('2', 'Level 1'),
            children: [
              {
                ...createProject('3', 'Level 2'),
                children: [createProject('4', 'Level 3')],
              },
            ],
          },
        ],
      };

      const ids = getProjectAndDescendantIds(project);

      expect(ids).toEqual(['1', '2', '3', '4']);
    });

    it('should collect from multiple branches', () => {
      const project: Project = {
        ...createProject('1', 'Root'),
        children: [
          {
            ...createProject('2', 'Branch A'),
            children: [createProject('4', 'A1')],
          },
          {
            ...createProject('3', 'Branch B'),
            children: [createProject('5', 'B1')],
          },
        ],
      };

      const ids = getProjectAndDescendantIds(project);

      expect(ids).toHaveLength(5);
      expect(ids).toContain('1');
      expect(ids).toContain('4');
      expect(ids).toContain('5');
    });
  });

  describe('getProjectPath', () => {
    it('should return single item path for root project', () => {
      const projects = [createProject('1', 'Root')];
      const path = getProjectPath(projects, '1');

      expect(path).toHaveLength(1);
      expect(path[0].id).toBe('1');
    });

    it('should return full path from root to target', () => {
      const projects = [
        createProject('1', 'Root'),
        createProject('2', 'Level 1', '1'),
        createProject('3', 'Level 2', '2'),
      ];

      const path = getProjectPath(projects, '3');

      expect(path).toHaveLength(3);
      expect(path.map(p => p.id)).toEqual(['1', '2', '3']);
    });

    it('should return empty array for non-existent project', () => {
      const projects = [createProject('1', 'Root')];
      const path = getProjectPath(projects, 'non-existent');

      expect(path).toEqual([]);
    });

    it('should handle middle-level target', () => {
      const projects = [
        createProject('1', 'Root'),
        createProject('2', 'Middle', '1'),
        createProject('3', 'Leaf', '2'),
      ];

      const path = getProjectPath(projects, '2');

      expect(path).toHaveLength(2);
      expect(path.map(p => p.id)).toEqual(['1', '2']);
    });
  });

  describe('findProjectInTree', () => {
    it('should find root-level project', () => {
      const tree = [
        { ...createProject('1', 'Root'), children: [] },
      ];

      const found = findProjectInTree(tree, '1');

      expect(found).not.toBeNull();
      expect(found?.id).toBe('1');
    });

    it('should find deeply nested project', () => {
      const tree: Project[] = [
        {
          ...createProject('1', 'Root'),
          children: [
            {
              ...createProject('2', 'Level 1'),
              children: [
                {
                  ...createProject('3', 'Target'),
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      const found = findProjectInTree(tree, '3');

      expect(found).not.toBeNull();
      expect(found?.id).toBe('3');
      expect(found?.name).toBe('Target');
    });

    it('should return null for non-existent project', () => {
      const tree = [{ ...createProject('1', 'Root'), children: [] }];

      const found = findProjectInTree(tree, 'non-existent');

      expect(found).toBeNull();
    });

    it('should find project in second root branch', () => {
      const tree: Project[] = [
        {
          ...createProject('1', 'Root A'),
          children: [{ ...createProject('2', 'A Child'), children: [] }],
        },
        {
          ...createProject('3', 'Root B'),
          children: [{ ...createProject('4', 'Target'), children: [] }],
        },
      ];

      const found = findProjectInTree(tree, '4');

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Target');
    });

    it('should return empty array for empty tree', () => {
      const found = findProjectInTree([], 'any');
      expect(found).toBeNull();
    });
  });

  describe('flattenProjectTree', () => {
    it('should return empty array for empty input', () => {
      const result = flattenProjectTree([]);
      expect(result).toEqual([]);
    });

    it('should add depth 0 for root projects', () => {
      const tree = [
        { ...createProject('1', 'Root 1'), children: [] },
        { ...createProject('2', 'Root 2'), children: [] },
      ];

      const result = flattenProjectTree(tree);

      expect(result).toHaveLength(2);
      expect(result[0].depth).toBe(0);
      expect(result[1].depth).toBe(0);
    });

    it('should increment depth for each level', () => {
      const tree: Project[] = [
        {
          ...createProject('1', 'Root'),
          children: [
            {
              ...createProject('2', 'Level 1'),
              children: [{ ...createProject('3', 'Level 2'), children: [] }],
            },
          ],
        },
      ];

      const result = flattenProjectTree(tree);

      expect(result).toHaveLength(3);
      expect(result[0].depth).toBe(0);
      expect(result[1].depth).toBe(1);
      expect(result[2].depth).toBe(2);
    });

    it('should maintain DFS order', () => {
      const tree: Project[] = [
        {
          ...createProject('1', 'Root'),
          children: [
            {
              ...createProject('2', 'Branch A'),
              children: [{ ...createProject('4', 'A1'), children: [] }],
            },
            {
              ...createProject('3', 'Branch B'),
              children: [{ ...createProject('5', 'B1'), children: [] }],
            },
          ],
        },
      ];

      const result = flattenProjectTree(tree);

      expect(result.map(p => p.id)).toEqual(['1', '2', '4', '3', '5']);
    });

    it('should allow starting from custom depth', () => {
      const tree = [{ ...createProject('1', 'Root'), children: [] }];

      const result = flattenProjectTree(tree, 5);

      expect(result[0].depth).toBe(5);
    });
  });
});
