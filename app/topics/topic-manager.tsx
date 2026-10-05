"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Topic } from "../services/topics";
import { useTopics } from "@/lib/query/topics/use-topics";
import { topicKeys } from "@/lib/query/topics/keys";

const PRESET_COLORS = [
  { name: "Blue", hex: "#3b82f6" },
  { name: "Green", hex: "#10b981" },
  { name: "Red", hex: "#ef4444" },
  { name: "Purple", hex: "#8b5cf6" },
  { name: "Orange", hex: "#f97316" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Slate", hex: "#64748b" },
];

type TopicManagerProps = {
  userRole: string;
};

export default function TopicManager({ userRole }: TopicManagerProps) {
  const queryClient = useQueryClient();
  const { data: topics = [] } = useTopics();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openCreateModal() {
    setEditingTopic(null);
    setName("");
    setColor("#3b82f6");
    setIsActive(true);
    setIsModalOpen(true);
  }

  function openEditModal(topic: Topic) {
    setEditingTopic(topic);
    setName(topic.name);
    setColor(topic.color);
    setIsActive(topic.is_active);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Topic name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTopic) {
        // Update topic
        const res = await fetch(`/api/backend/topics/${editingTopic.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color, is_active: isActive }),
        });
        const updated = await res.json();
        if (!res.ok) throw new Error(updated.detail ?? "Failed to update topic.");
        queryClient.setQueryData<Topic[]>(topicKeys.all, (current = []) =>
          current.map((t) => (t.id === editingTopic.id ? updated : t))
        );
        toast.success("Topic updated successfully!");
      } else {
        // Create topic
        const res = await fetch("/api/backend/topics/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color, is_active: isActive }),
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.detail ?? "Failed to create topic.");
        queryClient.setQueryData<Topic[]>(topicKeys.all, (current = []) => [
          created,
          ...current,
        ]);
        toast.success("Topic created successfully!");
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(topicId: number) {
    if (!confirm("Are you sure you want to delete this topic? Questions using this topic will be set to no topic.")) {
      return;
    }

    try {
      const res = await fetch(`/api/backend/topics/${topicId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Failed to delete topic.");
      }
      queryClient.setQueryData<Topic[]>(topicKeys.all, (current = []) =>
        current.filter((topic) => topic.id !== topicId)
      );
      toast.success("Topic deleted successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete topic.");
    }
  }

  const globalTopics = topics.filter((topic) => topic.org_id === 0);
  const organizationTopics = topics.filter((topic) => topic.org_id !== 0);

  function renderTopicCards(topicList: Topic[]) {
    return topicList.map((topic) => (
      <Card key={topic.id} className="relative overflow-hidden transition-all hover:shadow-md">
        <div
          className="absolute top-0 left-0 w-full h-1.5"
          style={{ backgroundColor: topic.color }}
        />
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <span
              className="inline-block w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
              style={{ backgroundColor: topic.color }}
            />
            {topic.name}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (ID: {topic.id})
            </span>
          </CardTitle>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              topic.org_id === 0
                ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50"
                : "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800"
            }`}
          >
            {topic.org_id === 0 ? "Global" : userRole === "0" ? `Org ID: ${topic.org_id}` : "Organization"}
          </span>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => openEditModal(topic)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => handleDelete(topic.id)}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    ));
  }

  return (
    <main className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage subject categories and custom tags for your questions.
          </p>
        </div>
        <Button onClick={openCreateModal}>Create topic</Button>
      </div>

      {topics.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
            No topics found. Click &quot;Create topic&quot; to get started.
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3">
              <h2 className="text-xl font-semibold">Global Topics</h2>
              <p className="text-sm text-muted-foreground">Topics available to every organization (org_id: 0).</p>
            </div>
            {globalTopics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {renderTopicCards(globalTopics)}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No global topics found.</p>
            )}
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-xl font-semibold">Organization Topics</h2>
              <p className="text-sm text-muted-foreground">
                {userRole === "0"
                  ? "Topics created across organizations."
                  : "Topics created for your organization."}
              </p>
            </div>
            {organizationTopics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {renderTopicCards(organizationTopics)}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No organization topics found.</p>
            )}
          </section>
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md animate-in fade-in-50 zoom-in-95 duration-150">
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                {editingTopic ? "Edit Topic" : "Create Topic"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic-name">Topic Name</Label>
                  <Input
                    id="topic-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. JavaScript, Physics, Algebra"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>Label Color</Label>
                  <div className="grid grid-cols-5 gap-2 mb-2">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className={`w-full h-8 rounded-md border flex items-center justify-center transition-all ${
                          color === preset.hex
                            ? "ring-2 ring-primary ring-offset-2 scale-105 border-transparent"
                            : "border-muted hover:scale-105"
                        }`}
                        style={{ backgroundColor: preset.hex }}
                        onClick={() => setColor(preset.hex)}
                        title={preset.name}
                      >
                        {color === preset.hex && (
                          <span className="w-2 h-2 rounded-full bg-white mix-blend-difference" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-12 h-10 p-0.5 cursor-pointer shrink-0"
                    />
                    <Input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#3b82f6"
                      className="font-mono text-sm uppercase"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save topic"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
