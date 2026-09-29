import { useQuery } from "@tanstack/react-query";
import {
  getAllOrganizations,
  getOrganization,
  getOrganizationUsers,
  Organization,
} from "@/app/services/organizations";
import { User } from "@/app/services/users";
import { organizationKeys } from "./keys";

export function useOrganizations(initialData?: Organization[]) {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: getAllOrganizations,
    initialData,
  });
}

export function useOrganizationById(organizationId: number, initialData?: Organization) {
  return useQuery({
    queryKey: organizationKeys.detail(organizationId),
    queryFn: () => getOrganization(organizationId),
    enabled: !!organizationId,
    initialData,
  });
}

export function useOrganizationUsers(organizationId: number, initialData?: User[]) {
  return useQuery({
    queryKey: organizationKeys.users(organizationId),
    queryFn: () => getOrganizationUsers(organizationId),
    enabled: !!organizationId,
    initialData,
  });
}
