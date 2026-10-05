"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Users,
    BarChart2,
    Eye,
    Search,
    X,
    Filter,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Copy,
    QrCode,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import QRCodeModal from "./qr-code-modal";
import type { TestSeries } from "../services/test-series";
import type { Question } from "../services/questions";
import type { Topic } from "../services/topics";

import TestSeriesModal, { TestSeriesModalFormData } from "./test-series-modal";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
        const remainingMins = mins % 60;
        return `${hrs}h${remainingMins > 0 ? ` ${remainingMins}m` : ""}`;
    }
    return `${mins}m`;
}

function formatExpiry(isoString: string): string {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Unknown validity";
    if (d < new Date()) return "Expired";
    return `Valid until ${d.toISOString().slice(0, 10)}`;
}

function StatPill({ label, value }: { label: string; value: number }) {
    return (
        <div className="border bg-card text-card-foreground flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs shadow-sm">
            <span className="text-muted-foreground font-medium">{label}:</span>
            <span className="font-bold">{value}</span>
        </div>
    );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function TestSeriesManager({
    initialSeries,
    organizations = {},
    userId,
    userRole,
    userOrgId,
}: {
    initialSeries: TestSeries[];
    organizations?: Record<number, string>;
    questions?: Question[];
    topics?: Topic[];
    userId: number;
    userRole?: string;
    userOrgId?: number;
}) {
    const router = useRouter();
    const [series, setSeries] = useState(initialSeries);
    const [busy, setBusy] = useState(false);
    const [newInviteToken, setNewInviteToken] = useState<string | null>(null);
    const [origin, setOrigin] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter controls state
    const [searchQuery, setSearchQuery] = useState("");
    const [accessFilter, setAccessFilter] = useState<"all" | "public" | "invite_only" | "private">("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [orgFilter, setOrgFilter] = useState("all");
    const [sortBy, setSortBy] = useState<"newest" | "name_asc" | "name_desc" | "attempts_desc">("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    function closeModal() {
        setIsCreateOpen(false);
    }

    useEffect(() => {
        if (typeof window !== "undefined") setOrigin(window.location.origin);
    }, []);

    // Collect available organization list for filter
    const availableOrgs = useMemo(() => {
        const orgsMap = new Map<string, string>();
        for (const s of series) {
            const idStr = String(s.org_id);
            const name = s.org_id === 0 ? "Safalya" : organizations[s.org_id] ?? `Organization #${s.org_id}`;
            orgsMap.set(idStr, name);
        }
        return Array.from(orgsMap.entries()).map(([id, name]) => ({ id, name }));
    }, [series, organizations]);

    // Filtering & Sorting
    const filteredSeries = useMemo(() => {
        const list = series.filter((s) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = s.name.toLowerCase().includes(q);
                const codeMatch = s.code?.toLowerCase().includes(q) ?? false;
                if (!nameMatch && !codeMatch) return false;
            }
            if (accessFilter !== "all") {
                if (s.access_type !== accessFilter) return false;
            }
            if (statusFilter !== "all") {
                if (statusFilter === "active" && s.is_active === false) return false;
                if (statusFilter === "inactive" && s.is_active !== false) return false;
            }
            if (orgFilter !== "all") {
                if (String(s.org_id) !== orgFilter) return false;
            }
            return true;
        });

        return list.sort((a, b) => {
            if (sortBy === "name_asc") return a.name.localeCompare(b.name, undefined, { numeric: true });
            if (sortBy === "name_desc") return b.name.localeCompare(a.name, undefined, { numeric: true });
            if (sortBy === "attempts_desc") return (b.attempt_count ?? 0) - (a.attempt_count ?? 0);
            return b.id - a.id;
        });
    }, [series, searchQuery, accessFilter, statusFilter, orgFilter, sortBy]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredSeries.length / pageSize) || 1;

    // Reset page on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, accessFilter, statusFilter, orgFilter, sortBy, pageSize]);


    const paginatedSeries = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredSeries.slice(start, start + pageSize);
    }, [filteredSeries, currentPage, pageSize]);

    const isFilterActive = searchQuery.trim() !== "" || accessFilter !== "all" || statusFilter !== "all" || orgFilter !== "all" || sortBy !== "newest";

    function clearFilters() {
        setSearchQuery("");
        setAccessFilter("all");
        setStatusFilter("all");
        setOrgFilter("all");
        setSortBy("newest");
        setCurrentPage(1);
    }

    async function handleModalSubmit(data: TestSeriesModalFormData) {
        setBusy(true);
        try {
            const res = await fetch("/api/backend/test-series/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    access_type: data.access_type,
                    valid_until: data.valid_until,
                    duration_seconds: data.duration_seconds,
                    questions: [],
                    is_active: data.is_active,
                }),
            });
            const responseData = await res.json().catch(() => null);
            if (!res.ok) throw new Error(getApiError(responseData, res.status));

            setSeries((prev) => [responseData as TestSeries, ...prev]);
            setNewInviteToken((responseData as TestSeries).invite_token ?? null);
            toast.success("Test created!");
            closeModal();
            router.push(`/test-series/${responseData.id}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to create Test .");
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete(seriesId: number, seriesName: string) {
        setDeleteTarget({ id: seriesId, name: seriesName });
    }

    async function handleToggleActive(seriesId: number, currentActive: boolean) {
        try {
            const nextActive = !currentActive;
            const res = await fetch(`/api/backend/test-series/${seriesId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: nextActive }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(getApiError(data, res.status));
            }
            setSeries((prev) =>
                prev.map((item) => (item.id === seriesId ? { ...item, is_active: nextActive } : item))
            );
            toast.success(`Test  marked as ${nextActive ? "Active" : "Inactive"}.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to update status.");
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/backend/test-series/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) {
                const data = await res.json().catch(() => null);
                throw new Error(getApiError(data, res.status));
            }
            setSeries((prev) => prev.filter((s) => s.id !== deleteTarget.id));
            toast.success("Test  deleted.");
            setDeleteTarget(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to delete Test .");
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            {/* ── Delete Confirmation Modal ── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete test ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-semibold text-foreground">&ldquo;{deleteTarget?.name}&rdquo;</span>.
                            This action cannot be undone. Any student attempts will be preserved but the series will no longer be accessible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* ── Page Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Test </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Create timed assessments, assign questions, and review student attempt performance.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Create Test
                    </Button>
                    <StatPill label="Total Series" value={series.length} />
                    <StatPill label="Active" value={series.filter((s) => s.is_active !== false && new Date(s.valid_until) >= new Date()).length} />
                    <StatPill label="Inactive" value={series.filter((s) => s.is_active === false).length} />
                </div>
            </div>

            {/* ── Invite Link Banner ── */}
            {newInviteToken && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-4 animate-in fade-in duration-200">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Invite link (copy it now — won&apos;t be shown again)</p>
                        <code className="mt-1 block break-all text-xs text-muted-foreground">
                            {`${origin}/student/join#token=${newInviteToken}`}
                        </code>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            navigator.clipboard.writeText(`${origin}/student/join#token=${newInviteToken}`);
                            toast.success("Copied!");
                        }}
                    >
                        Copy link
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setNewInviteToken(null)}
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {/* ── Create Modal ── */}
            <TestSeriesModal
                isOpen={isCreateOpen}
                onClose={closeModal}
                editingSeries={null}
                onSubmit={handleModalSubmit}
                busy={busy}
            />

            {/* ── Filter Controls Bar ── */}
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search Test  by title..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-8 h-9 text-xs"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Access Filter */}
                    <select
                        value={accessFilter}
                        onChange={(e) => setAccessFilter(e.target.value as any)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring min-w-[130px]"
                    >
                        <option value="all">All Access Types</option>
                        <option value="public">Public</option>
                        <option value="invite_only">Invite Only</option>
                        <option value="private">Private</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring min-w-[120px]"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    {/* Organization Filter */}
                    <select
                        value={orgFilter}
                        onChange={(e) => setOrgFilter(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring min-w-[150px]"
                    >
                        <option value="all">All Organizations</option>
                        {availableOrgs.map((org) => (
                            <option key={org.id} value={org.id}>
                                {org.name}
                            </option>
                        ))}
                    </select>

                    {/* Sort Dropdown */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                    >
                        <option value="newest">Newest First</option>
                        <option value="name_asc">Name (A–Z)</option>
                        <option value="name_desc">Name (Z–A)</option>
                        <option value="attempts_desc">Most Attempts</option>
                    </select>

                    {/* Per Page Select */}
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                    >
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                    </select>

                    {/* Clear Filters */}
                    {isFilterActive && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-9 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Clear filters
                        </Button>
                    )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span>
                        Showing <strong className="text-foreground font-semibold">{paginatedSeries.length}</strong> of{" "}
                        <strong className="text-foreground font-semibold">{filteredSeries.length}</strong> Test 
                    </span>
                    {isFilterActive && (
                        <span className="flex items-center gap-1.5 text-primary text-[11px]">
                            <Filter className="h-3 w-3" />
                            Filters active
                        </span>
                    )}
                </div>
            </div>

            {/* ── 2 Columns Grid View ── */}
            <section aria-label="Existing Test ">
                {filteredSeries.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-10 text-center bg-card">
                        {series.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No Test  found. Create your first Test  using the button above.</p>
                        ) : (
                            <>
                                <p className="text-muted-foreground text-sm">No Test  found matching your filters.</p>
                                {isFilterActive && (
                                    <Button variant="outline" size="sm" className="mt-4 gap-2 text-xs" onClick={clearFilters}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Clear filters
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">


                        {paginatedSeries.map((s) => {
                            const canEdit =
                                userRole === "0" ||
                                (userRole === "1" && userOrgId !== undefined && s.org_id === userOrgId) ||
                                s.created_by === userId ||
                                s.supervisor_id === userId ||
                                Boolean(s.teacher_group_id);

                            const canDelete =
                                userRole === "0" ||
                                (userRole === "1" && userOrgId !== undefined && s.org_id === userOrgId) ||
                                s.created_by === userId;

                            return (
                                <SeriesCard
                                    key={s.id}
                                    s={s}
                                    origin={origin}
                                    canEdit={canEdit}
                                    canDelete={canDelete}
                                    organizations={organizations}
                                    onDelete={handleDelete}
                                    onToggleActive={handleToggleActive}
                                />
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── Pagination Footer ── */}
            {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                        Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
                        <span className="font-semibold text-foreground">{totalPages}</span> (
                        <span className="font-semibold">{filteredSeries.length}</span> total series)
                    </p>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="h-8 gap-1 text-xs"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={page === currentPage ? "default" : "outline"}
                                    size="icon"
                                    onClick={() => setCurrentPage(page)}
                                    className="h-8 w-8 text-xs"
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="h-8 gap-1 text-xs"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SeriesCard({
    s,
    origin,
    canEdit,
    canDelete = false,
    organizations,
    onDelete,
    onToggleActive,
}: {
    s: TestSeries;
    origin: string;
    canEdit: boolean;
    canDelete?: boolean;
    organizations: Record<number, string>;
    onDelete: (id: number, name: string) => void;
    onToggleActive: (id: number, currentActive: boolean) => void;
}) {
    const [isQROpen, setIsQROpen] = useState(false);
    const expired = new Date(s.valid_until) < new Date();
    const orgName = s.org_id === 0 ? "Safalya" : organizations[s.org_id] ?? `Organization #${s.org_id}`;

    return (
        <>
            <div className="border bg-card text-card-foreground rounded-xl shadow-sm group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between">
                {/* accent stripe */}
                <div className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${expired ? "bg-muted-foreground/30" : "bg-primary"}`} />

                <div className="pl-5 pr-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold truncate text-base leading-snug hover:text-primary transition-colors">
                            <Link href={`/test-series/${s.id}/results`}>
                                {s.name}
                            </Link>
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {s.is_active === false ? (
                                <Badge
                                    variant="destructive"
                                    className={`text-[10px] ${canEdit ? "cursor-pointer hover:opacity-80" : ""}`}
                                    title={canEdit ? "Click to toggle active status" : "Inactive"}
                                    onClick={() => canEdit && onToggleActive(s.id, false)}
                                >
                                    Inactive
                                </Badge>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10 ${
                                        canEdit ? "cursor-pointer hover:opacity-80" : ""
                                    }`}
                                    title={canEdit ? "Click to toggle active status" : "Active"}
                                    onClick={() => canEdit && onToggleActive(s.id, true)}
                                >
                                    Active
                                </Badge>
                            )}
                            <Badge
                                variant={s.access_type === "public" ? "secondary" : "outline"}
                                className="text-[10px] capitalize"
                            >
                                {s.access_type.replace("_", " ")}
                            </Badge>
                        </div>
                    </div>

                    <p className="text-muted-foreground text-xs">
                        {s.questions.length === 0 ? (
                            <span className="text-amber-600 dark:text-amber-500 font-medium">Empty series — click edit to configure</span>
                        ) : (
                            `${s.questions.length} question${s.questions.length !== 1 ? "s" : ""}`
                        )}
                        {" · "}
                        {formatDuration(s.duration_seconds)} · {formatExpiry(s.valid_until)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span className="font-semibold text-primary">{orgName}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-medium text-foreground">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            {s.attempt_count ?? 0} attempt{(s.attempt_count ?? 0) !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {/* Invite Link & QR Code Buttons for Invite-only Test  */}
                    {(s.access_type === "invite_only" || s.invite_token) && (
                        <div className="flex items-center gap-2 pt-1.5 border-t border-border/40">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const shareToken = s.invite_token || s.code || String(s.id);
                                    navigator.clipboard.writeText(`${origin}/student/join#token=${shareToken}`);
                                    toast.success("Invite link copied!");
                                }}
                                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground font-medium"
                            >
                                <Copy className="h-3 w-3 text-primary" />
                                Copy Link
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsQROpen(true)}
                                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground font-medium"
                            >
                                <QrCode className="h-3 w-3 text-primary" />
                                QR Code
                            </Button>
                        </div>
                    )}
                </div>

                {/* Action Bar */}
                <div className="px-5 pb-4 pt-2 flex items-center gap-2 border-t bg-muted/20">
                    <Button
                        variant="default"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/test-series/${s.id}/results`} />}
                        className="flex-1 h-8 text-xs font-semibold gap-1.5"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        Results
                    </Button>
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={<Link href={`/test-series/${s.id}`} />}
                            className="flex-1 h-8 text-xs font-semibold"
                        >
                            Edit
                        </Button>
                    )}
                    {canDelete && (
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:border-destructive/50 shrink-0"
                            title="Delete Test "
                            onClick={() => onDelete(s.id, s.name)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            <QRCodeModal
                isOpen={isQROpen}
                onClose={() => setIsQROpen(false)}
                seriesName={s.name}
                inviteToken={s.invite_token || s.code || String(s.id)}
                origin={origin}
            />

        </>
    );
}


