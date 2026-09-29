import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateTestSeries,
  deleteTestSeries,
  uploadAnswerKey,
  deleteAnswerKey,
  TestSeriesUpdate,
} from "@/app/services/test-series";
import { testSeriesKeys } from "./keys";
import { toast } from "sonner";

export function useUpdateTestSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      seriesId,
      data,
    }: {
      seriesId: number;
      data: TestSeriesUpdate;
    }) => updateTestSeries(seriesId, data),
    onSuccess: (_, { seriesId }) => {
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.all });
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.detail(seriesId) });
      toast.success("Test series updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update test series.");
    },
  });
}

export function useDeleteTestSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seriesId: number) => deleteTestSeries(seriesId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.all });
      toast.success("Test series deleted successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete test series.");
    },
  });
}

export function useUploadAnswerKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ seriesId, file }: { seriesId: number; file: File }) =>
      uploadAnswerKey(seriesId, file),
    onSuccess: (_, { seriesId }) => {
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.answerKey(seriesId) });
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.detail(seriesId) });
      toast.success("Answer key uploaded successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to upload answer key.");
    },
  });
}

export function useDeleteAnswerKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seriesId: number) => deleteAnswerKey(seriesId),
    onSuccess: (_, seriesId) => {
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.answerKey(seriesId) });
      queryClient.invalidateQueries({ queryKey: testSeriesKeys.detail(seriesId) });
      toast.success("Answer key deleted successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete answer key.");
    },
  });
}
