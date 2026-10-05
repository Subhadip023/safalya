import { useQuery } from "@tanstack/react-query";
import {
  getAllQuestions,
  getQuestion,
  PaginatedQuestionResponse,
} from "@/app/services/questions";
import { questionKeys } from "./keys";

export function useQuestions(
  page: number = 1,
  pageSize: number = 10,
  topicId?: number,
  initialData?: PaginatedQuestionResponse
) {
  return useQuery({
    queryKey: questionKeys.list({ page, pageSize, topicId }),
    queryFn: () => getAllQuestions(page, pageSize, topicId),
    initialData,
  });
}

export function useQuestionById(questionId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: questionKeys.detail(questionId),
    queryFn: () => getQuestion(questionId),
    enabled: enabled && !!questionId,
  });
}
