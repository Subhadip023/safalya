import { useQuery } from "@tanstack/react-query";
import {
  getStudentBatches,
  getStudentBatch,
  getBatchStudents,
  StudentBatch,
  BatchStudent,
} from "@/app/services/student-batches";
import { studentBatchKeys } from "./keys";

export function useStudentBatches(initialData?: StudentBatch[]) {
  return useQuery({
    queryKey: studentBatchKeys.lists(),
    queryFn: getStudentBatches,
    initialData,
  });
}

export function useStudentBatchById(batchId: number, initialData?: StudentBatch) {
  return useQuery({
    queryKey: studentBatchKeys.detail(batchId),
    queryFn: () => getStudentBatch(batchId),
    enabled: !!batchId,
    initialData,
  });
}

export function useBatchStudents(batchId: number, initialData?: BatchStudent[]) {
  return useQuery({
    queryKey: studentBatchKeys.students(batchId),
    queryFn: () => getBatchStudents(batchId),
    enabled: !!batchId,
    initialData,
  });
}
