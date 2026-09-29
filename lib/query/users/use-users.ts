import { useQuery } from "@tanstack/react-query";
import {
  getAllUsers,
  getUser,
  getStudentHistory,
  User,
  StudentHistoryResponse,
} from "@/app/services/users";
import { userKeys } from "./keys";

export function useUsers(initialData?: User[]) {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: getAllUsers,
    initialData,
  });
}

export function useUserById(userId: number, initialData?: User) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUser(userId),
    enabled: !!userId,
    initialData,
  });
}

export function useStudentHistoryById(studentId: number, initialData?: StudentHistoryResponse) {
  return useQuery({
    queryKey: userKeys.studentHistory(studentId),
    queryFn: () => getStudentHistory(studentId),
    enabled: !!studentId,
    initialData,
  });
}
