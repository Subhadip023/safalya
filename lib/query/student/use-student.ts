import { useQuery } from "@tanstack/react-query";
import {
  getStudentTests,
  getStudentAttempt,
  getAttemptHistory,
  getTestSeriesQuestions,
  StudentAttemptParams,
  PaginatedTests,
  AttemptHistory,
} from "@/app/services/student";
import { studentKeys } from "./keys";

export function useStudentTests(params: StudentAttemptParams = {}, initialData?: PaginatedTests) {
  return useQuery({
    queryKey: studentKeys.tests(params),
    queryFn: () => getStudentTests(params),
    initialData,
  });
}

export function useStudentAttempt<T>(attemptId: string | number) {
  return useQuery({
    queryKey: studentKeys.attempt(attemptId),
    queryFn: () => getStudentAttempt<T>(attemptId),
    enabled: !!attemptId,
  });
}

export function useAttemptHistory(initialData?: AttemptHistory[]) {
  return useQuery({
    queryKey: studentKeys.history(),
    queryFn: getAttemptHistory,
    initialData,
  });
}

export function useTestSeriesQuestions<T>(seriesId: string | number) {
  return useQuery({
    queryKey: studentKeys.seriesQuestions(seriesId),
    queryFn: () => getTestSeriesQuestions<T>(seriesId),
    enabled: !!seriesId,
  });
}
