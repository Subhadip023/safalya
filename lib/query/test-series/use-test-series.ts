import { useQuery } from "@tanstack/react-query";
import {
  getAllTestSeries,
  getTestSeries,
  getTestSeriesResults,
  getAnswerKey,
  getTestSeriesStudents,
  TestSeries,
  TestSeriesResults,
} from "@/app/services/test-series";
import { testSeriesKeys } from "./keys";

export function useTestSeriesList(initialData?: TestSeries[]) {
  return useQuery({
    queryKey: testSeriesKeys.lists(),
    queryFn: getAllTestSeries,
    initialData,
  });
}

export function useTestSeriesById(seriesId: number, initialData?: TestSeries) {
  return useQuery({
    queryKey: testSeriesKeys.detail(seriesId),
    queryFn: () => getTestSeries(seriesId),
    enabled: !!seriesId,
    initialData,
  });
}

export function useTestSeriesResults(seriesId: number, initialData?: TestSeriesResults) {
  return useQuery({
    queryKey: testSeriesKeys.results(seriesId),
    queryFn: () => getTestSeriesResults(seriesId),
    enabled: !!seriesId,
    initialData,
  });
}

export function useAnswerKey(seriesId: number) {
  return useQuery({
    queryKey: testSeriesKeys.answerKey(seriesId),
    queryFn: () => getAnswerKey(seriesId),
    enabled: !!seriesId,
  });
}

export function useTestSeriesStudents(
  seriesId: number,
  params?: { page?: number; limit?: number; sort_order?: string; q?: string; exclude_batch_ids?: string }
) {
  return useQuery({
    queryKey: testSeriesKeys.students(seriesId, params),
    queryFn: () => getTestSeriesStudents(seriesId, params),
    enabled: !!seriesId,
  });
}
