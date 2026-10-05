"use client";

import { useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Search, Users, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StudentBatch, BatchStudent } from "../../services/student-batches";
import type { User } from "../../services/users";
import AddStudentModal from "@/components/add-student-modal";

function getApiError(data: unknown, status: number): string {
    if (data && typeof data === "object") {
        const v = data as { detail?: unknown; message?: unknown };
        if (typeof v.detail === "string") return v.detail;
        if (Array.isArray(v.detail)) {
            const msgs = v.detail.flatMap((i) =>
                i && typeof i === "object" && "msg" in i ? [String(i.msg)] : [],
            );
            if (msgs.length > 0) return msgs.join(", ");
        }
        if (typeof v.message === "string") return v.message;
    }
    return `Server returned error status ${status}`;
}

type StudentBatchEditorProps = {
    batch: StudentBatch;
    users: User[];
    initialStudents: BatchStudent[];
    organizationId: number;
    userRole?: string;
    currentUserId?: number;
};

export default function StudentBatchEditor({
    batch,
    users,
    initialStudents,
    organizationId,
    userRole,
    currentUserId,
}: StudentBatchEditorProps) {
    const router = useRouter();
    const isTeacher = userRole === "2";

    const [name, setName] = useState(batch.name);
    const [supervisorId, setSupervisorId] = useState<number>(batch.supervisor);
    const [isActive, setIsActive] = useState(batch.is_active);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(
        initialStudents.map((s) => s.student_id)
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState(5);
    const [studentPage, setStudentPage] = useState(1);
    const [busy, setBusy] = useState(false);
    const [localUsers, setLocalUsers] = useState<User[]>(users);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const eligibleSupervisors = useMemo(() => localUsers.filter((u) => u.role === 1 || u.role === 2), [localUsers]);
    const eligibleStudents = useMemo(() => localUsers.filter((u) => u.role === 3), [localUsers]);
    const currentSupervisor = useMemo(
        () => localUsers.find((u) => u.id === batch.supervisor),
        [localUsers, batch.supervisor]
    );

    const searchableStudents = useMemo(() => {
        if (!searchQuery.trim()) return eligibleStudents;
        const q = searchQuery.toLowerCase();
        return eligibleStudents.filter(
            (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
        );
    }, [eligibleStudents, searchQuery]);

    const studentTotalCount = searchableStudents.length;
    const studentTotalPages = Math.max(1, Math.ceil(studentTotalCount / pageSize));
    const effectivePage = Math.min(studentPage, studentTotalPages);

    const paginatedStudents = useMemo(() => {
        const start = (effectivePage - 1) * pageSize;
        return searchableStudents.slice(start, start + pageSize);
    }, [searchableStudents, effectivePage, pageSize]);

    const allOnPageSelected =
        paginatedStudents.length > 0 &&
        paginatedStudents.every((s) => selectedStudentIds.includes(s.id));

    function toggleSelectAllOnPage() {
        if (allOnPageSelected) {
            const pageIdSet = new Set(paginatedStudents.map((s) => s.id));
            setSelectedStudentIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
        } else {
            const toAdd = paginatedStudents
                .map((s) => s.id)
                .filter((id) => !selectedStudentIds.includes(id));
            setSelectedStudentIds((prev) => [...prev, ...toAdd]);
        }
    }

    function toggleStudent(studentId: number) {
        setSelectedStudentIds((prev) =>
            prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
        );
    }

    async function handleSaveChanges(e: FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Batch name is required.");
            return;
        }
        if (!supervisorId) {
            toast.error("Please select a supervisor.");
            return;
        }

        setBusy(true);
        try {
            // Update Batch Details
            const updatePayload: Record<string, any> = {
                name: name.trim(),
                is_active: isActive,
            };
            if (!isTeacher) {
                updatePayload.supervisor = supervisorId;
            }

            const res = await fetch(`/api/backend/student-batches/${batch.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(getApiError(data, res.status));

            // Sync Students
            const currentIds = initialStudents.map((s) => s.student_id);
            const toAdd = selectedStudentIds.filter(id => !currentIds.includes(id));
            const toRemove = currentIds.filter(id => !selectedStudentIds.includes(id));

            if (toAdd.length > 0) {
                const addRes = await fetch(`/api/backend/student-batches/${batch.id}/students`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ student_ids: toAdd }),
                });
                if (!addRes.ok) {
                    const addData = await addRes.json().catch(() => null);
                    console.error("Failed to add students:", addData);
                    toast.error(`Batch updated, but failed to assign some students: ${getApiError(addData, addRes.status)}`);
                }
            }

            for (const rId of toRemove) {
                const removeRes = await fetch(`/api/backend/student-batches/${batch.id}/students/${rId}`, {
                    method: "DELETE",
                });
                if (!removeRes.ok) {
                    console.error(`Failed to remove student ${rId}`);
                }
            }

            toast.success("Student batch saved successfully!");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to save student batch.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/student-batches" />}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Configure Student Batch</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Manage details and assigned students.
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-xs">
                    {selectedStudentIds.length} student{selectedStudentIds.length !== 1 ? "s" : ""}
                </Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Side: Batch Details */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Batch Details</CardTitle>
                            <CardDescription>Configure core batch information.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveChanges} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="b-name">Batch Name</Label>
                                    <Input
                                        id="b-name"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Class 10 - Batch A"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="b-supervisor">Batch Supervisor</Label>
                                    {isTeacher ? (
                                        <div className="border border-input bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground flex items-center justify-between">
                                            <span className="font-medium">
                                                {currentSupervisor?.name || "Batch Supervisor"} {currentSupervisor?.email ? `(${currentSupervisor.email})` : ""}
                                            </span>
                                            <Badge variant="outline" className="text-[10px]">Supervisor (Locked)</Badge>
                                        </div>
                                    ) : (
                                        <select
                                            id="b-supervisor"
                                            className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            value={supervisorId}
                                            onChange={(e) => setSupervisorId(Number(e.target.value))}
                                            required
                                        >
                                            <option value="" disabled>
                                                Select a supervisor...
                                            </option>
                                            {eligibleSupervisors.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} ({u.email}) - {u.role === 1 ? "Admin" : "Teacher"}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="b-status">Status</Label>
                                    <select
                                        id="b-status"
                                        className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={isActive ? "true" : "false"}
                                        onChange={(e) => setIsActive(e.target.value === "true")}
                                    >
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </div>

                                <div className="pt-4 border-t flex flex-col gap-2">
                                    <Button type="submit" className="w-full" disabled={busy}>
                                        {busy ? "Saving changes..." : "Save changes"}
                                    </Button>
                                    <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/student-batches" />}>
                                        Back to list
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Side: Students Checklist */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="flex flex-col h-full min-h-[450px]">
                        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4 space-y-0">
                            <div>
                                <CardTitle>Assign Students</CardTitle>
                                <CardDescription className="mt-1">Select students to include in this batch.</CardDescription>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <Badge variant="secondary" className="px-3 py-1 text-xs">
                                    {selectedStudentIds.length} selected
                                </Badge>
                                <Button 
                                    size="sm"
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
                                    type="button"
                                >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Add Student
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4 flex-1 flex flex-col">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search students by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setStudentPage(1);
                                        }}
                                        className="pl-9"
                                    />
                                </div>
                                {paginatedStudents.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={toggleSelectAllOnPage}
                                        className="h-9 text-xs shrink-0 whitespace-nowrap"
                                    >
                                        {allOnPageSelected ? "Deselect Page" : "Select Page"}
                                    </Button>
                                )}
                            </div>

                            {searchableStudents.length === 0 ? (
                                <div className="border border-dashed rounded-xl p-12 text-center flex-1 flex flex-col items-center justify-center">
                                    <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                    <p className="text-muted-foreground text-sm">
                                        {searchQuery ? "No students match your search." : "No students found in your organization."}
                                    </p>
                                </div>
                            ) : (
                                <div className="border rounded-xl divide-y overflow-hidden bg-card flex-1">
                                    {paginatedStudents.map((s) => {
                                        const isChecked = selectedStudentIds.includes(s.id);
                                        return (
                                            <label
                                                key={s.id}
                                                htmlFor={`student-${s.id}`}
                                                className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${
                                                    isChecked ? "bg-primary/5" : ""
                                                }`}
                                            >
                                                <input
                                                    id={`student-${s.id}`}
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleStudent(s.id)}
                                                    className="h-4 w-4 shrink-0 accent-primary"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium truncate">{s.name}</p>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground font-mono">
                                                            ID #{s.id}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{s.email}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Pagination Footer */}
                            {studentTotalCount > 0 && (
                                <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground mt-auto">
                                    <div className="flex items-center gap-2">
                                        <span>
                                            Showing <strong>{(effectivePage - 1) * pageSize + 1}</strong> -{" "}
                                            <strong>{Math.min(effectivePage * pageSize, studentTotalCount)}</strong> of{" "}
                                            <strong>{studentTotalCount}</strong> students
                                        </span>
                                        <select
                                            aria-label="Students per page"
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setStudentPage(1);
                                            }}
                                            className="border rounded px-1.5 py-0.5 text-xs bg-background focus:outline-none"
                                        >
                                            <option value={5}>5 / page</option>
                                            <option value={10}>10 / page</option>
                                            <option value={20}>20 / page</option>
                                            <option value={50}>50 / page</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={effectivePage <= 1}
                                            onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                                            className="h-8 px-2.5 text-xs flex items-center gap-1"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                            Previous
                                        </Button>

                                        <div className="flex items-center gap-1 px-1">
                                            {Array.from({ length: studentTotalPages }, (_, i) => i + 1)
                                                .filter((p) => {
                                                    return p === 1 || p === studentTotalPages || Math.abs(p - effectivePage) <= 1;
                                                })
                                                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                                                        acc.push("...");
                                                    }
                                                    acc.push(p);
                                                    return acc;
                                                }, [])
                                                .map((item, idx) => (
                                                    typeof item === "string" ? (
                                                        <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">...</span>
                                                    ) : (
                                                        <Button
                                                            key={item}
                                                            type="button"
                                                            size="sm"
                                                            variant={effectivePage === item ? "default" : "outline"}
                                                            onClick={() => setStudentPage(item)}
                                                            className="h-8 w-8 p-0 text-xs"
                                                        >
                                                            {item}
                                                        </Button>
                                                    )
                                                ))}
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={effectivePage >= studentTotalPages}
                                            onClick={() => setStudentPage((p) => Math.min(studentTotalPages, p + 1))}
                                            className="h-8 px-2.5 text-xs flex items-center gap-1"
                                        >
                                            Next
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-4 bg-muted/10">
                            <p className="text-xs text-muted-foreground">
                                Changes are saved together with batch details using &ldquo;Save changes&rdquo;.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
            
            <AddStudentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                organizationId={organizationId}
                onStudentAdded={(newStudent) => {
                    setLocalUsers((prev) => [newStudent, ...prev]);
                }}
            />
        </div>
    );
}
