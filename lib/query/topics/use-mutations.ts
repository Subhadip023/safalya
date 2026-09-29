import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTopic,
  updateTopic,
  deleteTopic,
  CreateTopicInput,
  UpdateTopicInput,
} from "@/app/services/topics";
import { topicKeys } from "./keys";
import { toast } from "sonner";

export function useCreateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTopicInput) => createTopic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: topicKeys.all });
      toast.success("Topic created successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create topic.");
    },
  });
}

export function useUpdateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      topicId,
      data,
    }: {
      topicId: number;
      data: UpdateTopicInput;
    }) => updateTopic(topicId, data),
    onSuccess: (_, { topicId }) => {
      queryClient.invalidateQueries({ queryKey: topicKeys.all });
      queryClient.invalidateQueries({ queryKey: topicKeys.detail(topicId) });
      toast.success("Topic updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update topic.");
    },
  });
}

export function useDeleteTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (topicId: number) => deleteTopic(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: topicKeys.all });
      toast.success("Topic deleted successfully!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete topic.");
    },
  });
}
