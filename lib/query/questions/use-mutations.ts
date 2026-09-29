import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  createQuestionOption,
  CreateQuestionInput,
  UpdateQuestionInput,
  QuestionOption,
} from "@/app/services/questions";
import { questionKeys } from "./keys";
import { toast } from "sonner";

export function useCreateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuestionInput) => createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionKeys.all });
      toast.success("Question created successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create question.");
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questionId,
      data,
    }: {
      questionId: number;
      data: UpdateQuestionInput;
    }) => updateQuestion(questionId, data),
    onSuccess: (_, { questionId }) => {
      queryClient.invalidateQueries({ queryKey: questionKeys.all });
      queryClient.invalidateQueries({ queryKey: questionKeys.detail(questionId) });
      toast.success("Question updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update question.");
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionId: number) => deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionKeys.all });
      toast.success("Question deleted successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete question.");
    },
  });
}

export function useCreateQuestionOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questionId,
      data,
    }: {
      questionId: number;
      data: QuestionOption;
    }) => createQuestionOption(questionId, data),
    onSuccess: (_, { questionId }) => {
      queryClient.invalidateQueries({ queryKey: questionKeys.detail(questionId) });
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create question option.");
    },
  });
}
