export const studentBatchKeys = {
  all: ["student-batches"] as const,
  lists: () => [...studentBatchKeys.all, "list"] as const,
  detail: (id: number) => [...studentBatchKeys.all, "detail", id] as const,
  students: (id: number) => [...studentBatchKeys.detail(id), "students"] as const,
};
