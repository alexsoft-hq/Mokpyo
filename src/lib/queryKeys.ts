// Single source of truth for TanStack Query cache keys.
// Keeping every key here prevents typo-drift between queries and invalidations.
//
// Convention: keys are org- and project-scoped where the underlying data is,
// so switching workspace/project naturally isolates caches.

export interface GoalsQueryParams {
  showCompleted?: boolean;
  includeDescendants?: boolean;
  showOnHold?: boolean;
  lightweight?: boolean;
  completedDateFrom?: string;
  completedDateTo?: string;
}

export const queryKeys = {
  goals: (orgId: string | null, projectId: string | null, params: GoalsQueryParams = {}) =>
    ['goals', orgId, projectId, params] as const,
  goal: (goalId: string) => ['goal', goalId] as const,
  categories: (projectId: string | null, includeDescendants = false) =>
    ['categories', projectId, includeDescendants] as const,
  users: (orgId: string | null) => ['users', orgId] as const,
  cycles: (orgId: string | null) => ['cycles', orgId] as const,

  // Feature pillars (populated in later phases)
  fieldSchema: (orgId: string | null, projectId: string | null) =>
    ['fieldSchema', orgId, projectId] as const,
  comments: (goalId: string) => ['comments', goalId] as const,
  automations: (projectId: string | null) => ['automations', projectId] as const,
  automationRuns: (ruleId: string) => ['automationRuns', ruleId] as const,
  views: (projectId: string | null, viewType?: string) =>
    ['views', projectId, viewType ?? null] as const,
} as const;
