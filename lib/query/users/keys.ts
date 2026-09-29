export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  detail: (id: number) => [...userKeys.all, "detail", id] as const,
  studentHistory: (studentId: number) => [...userKeys.detail(studentId), "history"] as const,
};
