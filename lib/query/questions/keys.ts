export const questionKeys = {
  all: ["questions"] as const,
  lists: () => [...questionKeys.all, "list"] as const,
  list: (params: { page?: number; pageSize?: number; topicId?: number }) =>
    [...questionKeys.lists(), params] as const,
  allList: () => [...questionKeys.all, "all-list"] as const,
  details: () => [...questionKeys.all, "detail"] as const,
  detail: (id: number) => [...questionKeys.details(), id] as const,
};
