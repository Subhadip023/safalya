import { useQuery } from "@tanstack/react-query";
import type { Topic } from "@/app/services/topics";
import { topicKeys } from "./keys";

async function fetchTopic<TopicResponse>(path: string): Promise<TopicResponse> {
  const response = await fetch(`/api/backend/topics/${path}`, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : `Request failed: ${response.status}`;
    throw new Error(detail);
  }
  return data as TopicResponse;
}

export function useTopics(initialData?: Topic[]) {
  return useQuery({
    queryKey: topicKeys.all,
    queryFn: () => fetchTopic<Topic[]>(""),
    initialData,
  });
}

export function useTopicById(topicId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: topicKeys.detail(topicId),
    queryFn: () => fetchTopic<Topic>(String(topicId)),
    enabled: enabled && !!topicId,
  });
}
