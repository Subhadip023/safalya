import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTeacherGroup,
  updateTeacherGroup,
  deleteTeacherGroup,
  CreateTeacherGroupInput,
  UpdateTeacherGroupInput,
} from "@/app/services/teacher-groups";
import { teacherGroupKeys } from "./keys";
import { toast } from "sonner";

export function useCreateTeacherGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeacherGroupInput) => createTeacherGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherGroupKeys.all });
      toast.success("Teacher group created successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create teacher group.");
    },
  });
}

export function useUpdateTeacherGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: number;
      data: UpdateTeacherGroupInput;
    }) => updateTeacherGroup(groupId, data),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: teacherGroupKeys.all });
      queryClient.invalidateQueries({ queryKey: teacherGroupKeys.detail(groupId) });
      toast.success("Teacher group updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update teacher group.");
    },
  });
}

export function useDeleteTeacherGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: number) => deleteTeacherGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherGroupKeys.all });
      toast.success("Teacher group deleted successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete teacher group.");
    },
  });
}
