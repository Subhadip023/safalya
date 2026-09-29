"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Plus,
  Search,
  GraduationCap,
  UserCheck,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { StudentBatch, BatchStudent } from "../services/student-batches";
import type { User } from "../services/users";

type StudentBatchManagerProps = {
  initialBatches: StudentBatch[];
  users: User[];
  initialBatchStudents: Record<number, BatchStudent[]>;
};

export default function StudentBatchManager({
  initialBatches,
  users,
  initialBatchStudents,
}: StudentBatchManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [batches, setBatches] = useState<StudentBatch[]>(initialBatches);
  const [deletingBatchId, setDeletingBatchId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase();
    return batches.filter((b) => b.name.toLowerCase().includes(q));
  }, [batches, searchQuery]);

  // Helper to get supervisor details
  const getSupervisor = (supervisorId: number) => {
    return users.find((u) => u.id === supervisorId) || { name: `User #${supervisorId}`, email: "" };
  };

  const confirmDelete = async () => {
    if (!deletingBatchId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/backend/student-batches/${deletingBatchId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete batch");

      setBatches((prev) => prev.filter((b) => b.id !== deletingBatchId));
      toast.success("Student batch deleted successfully.");
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while deleting the student batch.");
    } finally {
      setIsDeleting(false);
      setDeletingBatchId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-primary" />
            Student Batches
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organize and manage student batches and enrollments.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/student-batches/create" />}
          className="flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Student Batch
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search student batches..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty State or Grid */}
      {filteredBatches.length === 0 ? (
        <div className="text-center py-16 border rounded-xl border-dashed bg-card/50">
          <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No Student Batches Found</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            {searchQuery
              ? "No batches match your search filter."
              : "Get started by creating your first student batch."}
          </p>
          {!searchQuery && (
            <Button
              nativeButton={false}
              render={<Link href="/student-batches/create" />}
              variant="outline"
            >
              Create Batch Now
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBatches.map((batch) => {
            const supervisor = getSupervisor(batch.supervisor);
            const assignedStudents = initialBatchStudents[batch.id] || [];

            return (
              <Card
                key={batch.id}
                className="relative overflow-hidden transition-all duration-200 hover:shadow-lg border-border/80 flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl font-bold text-foreground truncate" title={batch.name}>
                        {batch.name}
                      </CardTitle>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${
                          batch.is_active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
                        }`}
                      >
                        {batch.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Inactive
                          </>
                        )}
                      </span>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      ID: #{batch.id} • Created {formatDate(batch.created_at)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Supervisor Section */}
                    <div className="rounded-lg bg-muted/40 p-3 border border-border/50">
                      <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider block mb-1">
                        Supervisor
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{supervisor.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {supervisor.email || "No email provided"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Students Section */}
                    <div>
                      <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider block mb-2">
                        Assigned Students ({assignedStudents.length})
                      </span>
                      {assignedStudents.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No students assigned yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                          {assignedStudents.slice(0, 6).map((student) => (
                            <span
                              key={student.id}
                              className="inline-flex items-center text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-medium"
                            >
                              {student.name || `Student #${student.student_id}`}
                            </span>
                          ))}
                          {assignedStudents.length > 6 && (
                            <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-medium">
                              +{assignedStudents.length - 6} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 pt-0 border-t border-border/40 mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/student-batches/${batch.id}`} />}
                    className="flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingBatchId(batch.id)}
                    className="text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deletingBatchId !== null} onOpenChange={(open) => !open && setDeletingBatchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this student batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the batch and its student assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
