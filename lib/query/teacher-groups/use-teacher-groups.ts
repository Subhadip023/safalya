import { useQuery } from "@tanstack/react-query";
import {
  getAllTeacherGroups,
  getTeacherGroup,
  TeacherGroup,
} from "@/app/services/teacher-groups";
import { teacherGroupKeys } from "./keys";

export function useTeacherGroups(initialData?: TeacherGroup[]) {
  return useQuery({
    queryKey: teacherGroupKeys.lists(),
    queryFn: getAllTeacherGroups,
    initialData,
  });
}

export function useTeacherGroupById(groupId: number, initialData?: TeacherGroup) {
  return useQuery({
    queryKey: teacherGroupKeys.detail(groupId),
    queryFn: () => getTeacherGroup(groupId),
    enabled: !!groupId,
    initialData,
  });
}
