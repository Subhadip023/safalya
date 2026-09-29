import { useQuery } from "@tanstack/react-query";
import { getAllTopics, getTopic, Topic } from "@/app/services/topics";
import { topicKeys } from "./keys";

export function useTopics(initialData?: Topic[]) {
  return useQuery({
    queryKey: topicKeys.all,
    queryFn: getAllTopics,
    initialData,
  });
}

export function useTopicById(topicId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: topicKeys.detail(topicId),
    queryFn: () => getTopic(topicId),
    enabled: enabled && !!topicId,
  });
}
