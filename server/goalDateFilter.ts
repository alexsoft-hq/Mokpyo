/**
 * Build Prisma OR clause for filtering completed goals by date range.
 * - Non-completed goals: always included
 * - Completed goals without dates: always included
 * - Completed goals with dates: included only if their date range overlaps [dateFrom, dateTo]
 */
export function buildCompletedDateFilter(
  completedDateFrom?: string,
  completedDateTo?: string,
): object[] | undefined {
  if (!completedDateFrom && !completedDateTo) return undefined;

  return [
    { completed: false }, // non-completed: always included
    { completed: true, startDate: null }, // no dates: included
    { completed: true, dueDate: null },   // no dates: included
    {
      completed: true,
      ...(completedDateFrom ? { dueDate: { gte: completedDateFrom } } : {}),
      ...(completedDateTo ? { startDate: { lte: completedDateTo } } : {}),
    },
  ];
}
