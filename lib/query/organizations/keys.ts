export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  detail: (id: number) => [...organizationKeys.all, "detail", id] as const,
  users: (id: number) => [...organizationKeys.detail(id), "users"] as const,
};
