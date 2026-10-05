"use client";

import { useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TeacherGroup } from "../../services/teacher-groups";
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

type TeacherGroupEditorProps = {
    group: TeacherGroup;
    users: User[];
    userRole?: string;
    currentUserId?: number;
};

export default function TeacherGroupEditor({ group, users, userRole, currentUserId }: TeacherGroupEditorProps) {
    const router = useRouter();
    const isTeacher = userRole === "2";

    const [name, setName] = useState(group.name);
    const [supervisorId, setSupervisorId] = useState<number>(group.supervisor);
    const [isActive, setIsActive] = useState(group.is_active);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(
        group.teachers.map((t) => t.id)
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [busy, setBusy] = useState(false);

    const eligibleSupervisors = useMemo(() => users.filter((u) => u.role === 1 || u.role === 2), [users]);
    const eligibleTeachers = useMemo(() => users.filter((u) => u.role === 2), [users]);
    const supervisorUser = useMemo(() => users.find((u) => u.id === supervisorId), [users, supervisorId]);

    const searchableTeachers = useMemo(() => {
        if (!searchQuery.trim()) return eligibleTeachers;
        const q = searchQuery.toLowerCase();
        return eligibleTeachers.filter(
            (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
        );
    }, [eligibleTeachers, searchQuery]);

    function toggleTeacher(teacherId: number) {
        setSelectedTeacherIds((prev) =>
            prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
        );
    }

    async function handleSaveChanges(e: FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Group name is required.");
            return;
        }
        if (!isTeacher && !supervisorId) {
            toast.error("Please select a supervisor.");
            return;
        }

        setBusy(true);
        try {
            const updatePayload: Record<string, any> = {
                name: name.trim(),
                teacher_ids: selectedTeacherIds,
                is_active: isActive,
            };
            if (!isTeacher) {
                updatePayload.supervisor = supervisorId;
            }

            const res = await fetch(`/api/backend/teacher-groups/${group.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(getApiError(data, res.status));

            toast.success("Teacher group saved successfully!");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to save teacher group.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/teacher-groups" />}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Configure Teacher Group</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Manage details and assigned teachers.
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-xs">
                    {selectedTeacherIds.length} teacher{selectedTeacherIds.length !== 1 ? "s" : ""}
                </Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Side: Group Details */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Group Details</CardTitle>
                            <CardDescription>Configure core group information.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveChanges} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="g-name">Group Name</Label>
                                    <Input
                                        id="g-name"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Mathematics Department"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="g-supervisor">Group Supervisor</Label>
                                    {isTeacher ? (
                                        <div className="border border-input bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground flex items-center justify-between">
                                            <span className="font-medium">
                                                {supervisorUser?.name || "You"} {supervisorUser?.email ? `(${supervisorUser.email})` : ""}
                                            </span>
                                            <Badge variant="secondary" className="text-[10px]">Supervisor (Locked)</Badge>
                                        </div>
                                    ) : (
                                        <select
                                            id="g-supervisor"
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
                                    <Label htmlFor="g-status">Status</Label>
                                    <select
                                        id="g-status"
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
                                    <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/teacher-groups" />}>
                                        Back to list
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Side: Teachers Checklist */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="flex flex-col h-full min-h-[450px]">
                        <CardHeader className="pb-3">
                            <CardTitle>Assign Teachers</CardTitle>
                            <CardDescription>Select teachers to include in this group.</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4 flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search teachers by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            {searchableTeachers.length === 0 ? (
                                <div className="border border-dashed rounded-xl p-12 text-center">
                                    <Users className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                    <p className="text-muted-foreground text-sm">
                                        {searchQuery ? "No teachers match your search." : "No teachers found in your organization."}
                                    </p>
                                </div>
                            ) : (
                                <div className="border rounded-xl divide-y overflow-hidden bg-card max-h-[420px] overflow-y-auto">
                                    {searchableTeachers.map((t) => {
                                        const isChecked = selectedTeacherIds.includes(t.id);
                                        return (
                                            <label
                                                key={t.id}
                                                htmlFor={`teacher-${t.id}`}
                                                className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${
                                                    isChecked ? "bg-primary/5" : ""
                                                }`}
                                            >
                                                <input
                                                    id={`teacher-${t.id}`}
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleTeacher(t.id)}
                                                    className="h-4 w-4 shrink-0 accent-primary"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate">{t.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-4 bg-muted/10">
                            <p className="text-xs text-muted-foreground">
                                Changes are saved together with group details using &ldquo;Save changes&rdquo;.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
