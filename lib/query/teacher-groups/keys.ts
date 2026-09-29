export const teacherGroupKeys = {
  all: ["teacher-groups"] as const,
  lists: () => [...teacherGroupKeys.all, "list"] as const,
  detail: (id: number) => [...teacherGroupKeys.all, "detail", id] as const,
};
