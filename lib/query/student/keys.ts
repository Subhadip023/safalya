import { StudentAttemptParams } from "@/app/services/student";

export const studentKeys = {
  all: ["student"] as const,
  tests: (params?: StudentAttemptParams) => [...studentKeys.all, "tests", params] as const,
  attempt: (attemptId: string | number) => [...studentKeys.all, "attempt", attemptId] as const,
  history: () => [...studentKeys.all, "history"] as const,
  seriesQuestions: (seriesId: string | number) => [...studentKeys.all, "series-questions", seriesId] as const,
};
