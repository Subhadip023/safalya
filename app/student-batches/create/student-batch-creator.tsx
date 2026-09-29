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

import type { User } from "../../services/users";

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

import AddStudentModal from "@/components/add-student-modal";

type StudentBatchCreatorProps = {
    users: User[];
    organizationId: number;
};

export default function StudentBatchCreator({ users, organizationId }: StudentBatchCreatorProps) {
    const router = useRouter();

    const [localUsers, setLocalUsers] = useState<User[]>(users);

    const eligibleSupervisors = useMemo(() => localUsers.filter((u) => u.role === 1 || u.role === 2), [localUsers]);
    const eligibleStudents = useMemo(() => localUsers.filter((u) => u.role === 3), [localUsers]);

    const [batchName, setBatchName] = useState("");
    const [supervisorId, setSupervisorId] = useState<number | "">(
        eligibleSupervisors.length > 0 ? eligibleSupervisors[0].id : ""
    );
    const [status, setStatus] = useState("active");
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState(5);
    const [studentPage, setStudentPage] = useState(1);
    const [busy, setBusy] = useState(false);
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const searchableStudents = useMemo(() => {
        if (!searchQuery.trim()) return eligibleStudents;
        const q = searchQuery.toLowerCase();
        return eligibleStudents.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q)
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

    async function handleCreate(e: FormEvent) {
        e.preventDefault();
        if (!batchName.trim()) {
            toast.error("Batch name is required.");
            return;
        }
        if (!supervisorId) {
            toast.error("Please select a supervisor.");
            return;
        }

        setBusy(true);
        try {
            // Step 1: Create Batch
            const res = await fetch("/api/backend/student-batches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: batchName.trim(),
                    supervisor: Number(supervisorId),
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(getApiError(data, res.status));

            // Step 1b: Update status if inactive
            if (status === "inactive") {
                await fetch(`/api/backend/student-batches/${data.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_active: false }),
                }).catch(() => null);
            }

            // Step 2: Assign Students (if any)
            if (selectedStudentIds.length > 0) {
                const addRes = await fetch(`/api/backend/student-batches/${data.id}/students`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        student_ids: selectedStudentIds,
                    }),
                });
                const addData = await addRes.json().catch(() => null);
                if (!addRes.ok) {
                    console.error("Failed to assign students:", addData);
                    toast.error(`Batch created, but failed to assign some students: ${getApiError(addData, addRes.status)}`);
                }
            }

            toast.success("Student batch created successfully");
            router.push("/student-batches");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to create student batch.");
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
                        <h1 className="text-3xl font-bold tracking-tight">Create Student Batch</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Set up batch details and assign students.
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
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="b-name">Batch Name</Label>
                                    <Input
                                        id="b-name"
                                        required
                                        autoFocus
                                        value={batchName}
                                        onChange={(e) => setBatchName(e.target.value)}
                                        placeholder="e.g. Class 10 - Batch A"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="b-supervisor">Batch Supervisor</Label>
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
                                        {eligibleSupervisors.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="b-status">Status</Label>
                                    <select
                                        id="b-status"
                                        className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                                <div className="pt-4 border-t flex flex-col gap-2">
                                    <Button type="submit" className="w-full" disabled={busy}>
                                        {busy ? "Creating batch..." : "Create Batch"}
                                    </Button>
                                    <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/student-batches" />}>
                                        Back to list
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Side: Assign Students */}
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
                                        {searchQuery ? "No students match your search." : "No students found."}
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
                                Student selections are saved together with batch details.
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
