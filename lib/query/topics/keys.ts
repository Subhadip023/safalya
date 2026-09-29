export const topicKeys = {
  all: ["topics"] as const,
  lists: () => [...topicKeys.all, "list"] as const,
  detail: (id: number) => [...topicKeys.all, "detail", id] as const,
};
