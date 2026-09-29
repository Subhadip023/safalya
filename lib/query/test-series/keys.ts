export const testSeriesKeys = {
  all: ["test-series"] as const,
  lists: () => [...testSeriesKeys.all, "list"] as const,
  details: () => [...testSeriesKeys.all, "detail"] as const,
  detail: (id: number) => [...testSeriesKeys.details(), id] as const,
  results: (id: number) => [...testSeriesKeys.detail(id), "results"] as const,
  answerKey: (id: number) => [...testSeriesKeys.detail(id), "answer-key"] as const,
  students: (id: number, params?: Record<string, unknown>) =>
    [...testSeriesKeys.detail(id), "students", params] as const,
};
