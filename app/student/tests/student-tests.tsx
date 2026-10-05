"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, X, Tag, Filter, RotateCcw, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Check } from "lucide-react";
import type { PaginatedTests } from "./page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Loader from "@/components/loader";
import { useTopics } from "@/lib/query/topics/use-topics";

function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.ceil((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

type StudentTestsProps = {
    paginatedTests: PaginatedTests;
    organizations?: Record<number, string>;
    initialParams: {
        q: string;
        topic: string;
        org_id: string;
        sort_order: string;
        access_type: string;
        page: number;
        limit: number;
    };
};

export default function StudentTests({
    paginatedTests,
    organizations = {},
    initialParams,
}: StudentTestsProps) {
    const { data: topics = [] } = useTopics();
    const [busy, setBusy] = useState<number | null>(null);
    const [pendingTestId, setPendingTestId] = useState<number | null>(null);
    const [instructionsAccepted, setInstructionsAccepted] = useState(false);
    const [searchQuery, setSearchQuery] = useState(initialParams.q);
    const [selectedTopic, setSelectedTopic] = useState(initialParams.topic);
    const [selectedOrg, setSelectedOrg] = useState(initialParams.org_id);
    const [sortOrder, setSortOrder] = useState(initialParams.sort_order);
    const [accessType, setAccessType] = useState(initialParams.access_type);
    const [pageSize, setPageSize] = useState(initialParams.limit);

    useEffect(() => {
        setSearchQuery(initialParams.q);
        setSelectedTopic(initialParams.topic);
        setSelectedOrg(initialParams.org_id);
        setSortOrder(initialParams.sort_order);
        setAccessType(initialParams.access_type);
        setPageSize(initialParams.limit);
    }, [initialParams.q, initialParams.topic, initialParams.org_id, initialParams.sort_order, initialParams.access_type, initialParams.limit]);

    const activeTab = accessType === "private" || accessType === "organization" ? "organization" : accessType === "public" ? "public" : "all";

    const router = useRouter();
    const [isFilterPending, startFilterTransition] = useTransition();
    const pendingTest = paginatedTests.items.find((test) => test.id === pendingTestId);
    const attemptBySeriesId = new Map<
        number,
        { id: number; status: number | string; score: string; total_marks: string }
    >();

    // Available topic names
    const availableTopics = useMemo(() => {
        const set = new Set<string>(topics.map((topic) => topic.name));
        for (const t of paginatedTests.items) {
            if (t.topics) {
                for (const tp of t.topics) {
                    if (tp) set.add(tp);
                }
            }
        }
        return Array.from(set).sort();
    }, [paginatedTests.items, topics]);

    // Available organization list
    const availableOrgs = useMemo(() => {
        const orgsMap = new Map<string, string>();
        for (const t of paginatedTests.items) {
            const idStr = String(t.org_id);
            const name = t.org_id === 0 ? "Safalya" : organizations[t.org_id] ?? `Organization #${t.org_id}`;
            orgsMap.set(idStr, name);
        }
        return Array.from(orgsMap.entries()).map(([id, name]) => ({ id, name }));
    }, [paginatedTests.items, organizations]);

    // Filter items based on selected tab
    const displayItems = paginatedTests.items;

    const isFilterActive =
        searchQuery.trim() !== "" ||
        selectedTopic !== "" ||
        selectedOrg !== "" ||
        sortOrder !== "asc" ||
        accessType !== "";

    function updateBackendQuery(newParams: {
        q?: string;
        topic?: string;
        org_id?: string;
        sort_order?: string;
        access_type?: string;
        page?: number;
        limit?: number;
    }) {
        const q = newParams.q !== undefined ? newParams.q : searchQuery;
        const topic = newParams.topic !== undefined ? newParams.topic : selectedTopic;
        const org_id = newParams.org_id !== undefined ? newParams.org_id : selectedOrg;
        const sort_order = newParams.sort_order !== undefined ? newParams.sort_order : sortOrder;
        const access_type = newParams.access_type !== undefined ? newParams.access_type : accessType;
        const page = newParams.page !== undefined ? newParams.page : paginatedTests.page;
        const limit = newParams.limit !== undefined ? newParams.limit : pageSize;

        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (topic) params.set("topic", topic);
        if (org_id) params.set("org_id", org_id);
        if (sort_order && sort_order !== "asc") params.set("sort_order", sort_order);
        if (access_type) params.set("access_type", access_type);
        if (page > 1) params.set("page", String(page));
        if (limit !== 10) params.set("limit", String(limit));

        startFilterTransition(() => {
            router.push(`/student/tests?${params.toString()}`);
        });
    }

    function handleTabChange(tab: "all" | "public" | "organization") {
        const newAccessType = tab === "organization" ? "private" : tab === "public" ? "public" : "";
        setAccessType(newAccessType);
        updateBackendQuery({ access_type: newAccessType, page: 1 });
    }

    function handleSearchChange(value: string) {
        setSearchQuery(value);
        updateBackendQuery({ q: value, page: 1 });
    }

    function handleTopicChange(value: string) {
        setSelectedTopic(value);
        updateBackendQuery({ topic: value, page: 1 });
    }

    function handleOrgChange(value: string) {
        setSelectedOrg(value);
        updateBackendQuery({ org_id: value, page: 1 });
    }

    function handleSortChange(value: string) {
        setSortOrder(value);
        updateBackendQuery({ sort_order: value, page: 1 });
    }

    function handleLimitChange(value: number) {
        setPageSize(value);
        updateBackendQuery({ limit: value, page: 1 });
    }

    function handlePageChange(newPage: number) {
        updateBackendQuery({ page: newPage });
    }

    function clearFilters() {
        setSearchQuery("");
        setSelectedTopic("");
        setSelectedOrg("");
        setSortOrder("asc");
        setAccessType("");
        startFilterTransition(() => {
            router.push("/student/tests");
        });
    }

    async function start(seriesId: number) {
        setBusy(seriesId);
        try {
            if (!document.fullscreenElement) {
                document.documentElement.classList.add("exam-fullscreen");
                await document.documentElement.requestFullscreen();
            }

            const res = await fetch("/api/backend/student/test-series/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ series_id: seriesId }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const msg = typeof data?.detail === "string" ? data.detail : "Unable to start test.";
                throw new Error(msg);
            }

            const attemptId = (data as { id: number }).id;

            setPendingTestId(null);
            router.push(`/student/attempts/${attemptId}?started=1`);
        } catch (err) {
            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => undefined);
            }
            document.documentElement.classList.remove("exam-fullscreen");
            toast.error(err instanceof Error ? err.message : "Unable to start test.");
        } finally {
            setTimeout(() => setBusy(null), 2000);
            // setBusy(null);
        }
    }

    if (paginatedTests.total === 0 && !isFilterActive) {
        return (
            <div className="mx-auto max-w-4xl">
                <h1 className="mb-6 text-3xl font-bold tracking-tight">Available tests</h1>
                <p className="text-muted-foreground">No public tests are currently available.</p>
            </div>
        );
    }

    return (
        <>
        {pendingTest && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <Card className="w-full max-w-3xl border-primary/20 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-2xl">Start this test</CardTitle>
                        <CardDescription>{pendingTest.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border bg-muted/40 p-3 text-center">
                                <p className="text-xl font-bold">{pendingTest.question_count}</p>
                                <p className="text-xs text-muted-foreground">
                                    Question{pendingTest.question_count === 1 ? "" : "s"}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/40 p-3 text-center">
                                <p className="text-xl font-bold">{formatDuration(pendingTest.duration_seconds)}</p>
                                <p className="text-xs text-muted-foreground">Test duration</p>
                            </div>
                            <div className="rounded-lg border bg-muted/40 p-3 text-center">
                                <p className="text-xl font-bold">{pendingTest.total_marks ? pendingTest.total_marks : pendingTest.question_count}</p>
                                <p className="text-xs text-muted-foreground">Total Marks</p>
                            </div>
                        </div>

                        {pendingTest.has_negative_marks ? (
                            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive font-medium">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>
                                    <strong>Negative Marking Applicable:</strong> Wrong answers will deduct up to{" "}
                                    <strong>{pendingTest.max_negative_mark ? `-${pendingTest.max_negative_mark}` : "negative"}</strong> marks per question. Unattempted questions carry 0 penalty.
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                <Check className="h-4 w-4 shrink-0" />
                                <span>
                                    <strong>No Negative Marking:</strong> Incorrect answers carry 0 negative penalty.
                                </span>
                            </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-3 text-sm">
                            <div className="rounded-lg border bg-muted/40 p-4">
                                <p className="font-semibold">Fullscreen mode required</p>
                                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                                    You must remain in fullscreen mode. Exiting fullscreen at any time will cause your test to be <strong>force submitted</strong> immediately.
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/40 p-4">
                                <p className="font-semibold">Do not switch tabs or windows</p>
                                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                                    Switching tabs, minimizing the window, or navigating away will trigger an immediate <strong>force submission</strong>.
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/40 p-4">
                                <p className="font-semibold">Keyboard restrictions</p>
                                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                                    Only <strong>Arrow keys</strong> (to navigate questions) and <strong>Enter key</strong> are allowed. All other keyboard keys are disabled.
                                </p>
                            </div>
                        </div>
                        <label
                            htmlFor="accept-test-instructions"
                            className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm"
                        >
                            <input
                                id="accept-test-instructions"
                                type="checkbox"
                                checked={instructionsAccepted}
                                onChange={(event) => setInstructionsAccepted(event.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                            />
                            <span>
                                I have read and understood the instructions and agree to follow the test rules.
                            </span>
                        </label>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setPendingTestId(null);
                                    setInstructionsAccepted(false);
                                }}
                                disabled={busy !== null}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 cursor-pointer"
                                onClick={() => start(pendingTest.id)}
                                disabled={!instructionsAccepted || busy !== null}
                            >
                                {busy === pendingTest.id ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Starting test…
                                    </>
                                ) : (
                                    "Start test in fullscreen"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {busy !== null && (
            <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-lg font-bold">Initializing Exam Environment</h3>
                    <p className="text-sm text-muted-foreground">Setting up fullscreen security and generating question attempt…</p>
                </div>
            </div>
        )}

        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {activeTab === "organization" ? "Your Tests" : "Available tests"}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {activeTab === "organization"
                            ? "Private assessments assigned directly to your organization and student batch."
                            : "Explore available assessments and start your test."}
                    </p>
                </div>

                {/* Organization Tab Switcher */}
                <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
                    <button
                        type="button"
                        onClick={() => handleTabChange("all")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            activeTab === "all"
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        All Tests
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange("public")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                            activeTab === "public"
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Public Tests
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange("organization")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === "organization"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <span>Organization (Your Tests)</span>
                        {paginatedTests.total > 0 && activeTab === "organization" && (
                            <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px]"
                            >
                                {paginatedTests.total}
                            </Badge>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Backend Filter & Sort Controls Bar ── */}
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search Topic / Name */}
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by test name or topic..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 pr-8 h-9 text-xs"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => handleSearchChange("")}
                                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Select Topic Dropdown */}
                    <select
                        value={selectedTopic}
                        onChange={(e) => handleTopicChange(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
                    >
                        <option value="">All Topics</option>
                        {availableTopics.map((topicName) => (
                            <option key={topicName} value={topicName}>
                                {topicName}
                            </option>
                        ))}
                    </select>

                    {/* Select Organization Dropdown */}
                    <select
                        value={selectedOrg}
                        onChange={(e) => handleOrgChange(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring min-w-[150px]"
                    >
                        <option value="">All Organizations</option>
                        {availableOrgs.map((org) => (
                            <option key={org.id} value={org.id}>
                                {org.name}
                            </option>
                        ))}
                    </select>

                    {/* Alphabetical Sort Dropdown */}
                    <select
                        value={sortOrder}
                        onChange={(e) => handleSortChange(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                    >
                        <option value="asc">Alphabetical (A–Z)</option>
                        <option value="desc">Alphabetical (Z–A)</option>
                    </select>

                    {/* Per Page Select */}
                    <select
                        value={pageSize}
                        onChange={(e) => handleLimitChange(Number(e.target.value))}
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                    >
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                    </select>

                    {/* Clear Filters Button */}
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

                {/* Filter info summary */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span>
                        Showing <strong className="text-foreground font-semibold">{displayItems.length}</strong> of{" "}
                        <strong className="text-foreground font-semibold">{paginatedTests.total}</strong> total tests
                    </span>
                    {isFilterActive && (
                        <span className="flex items-center gap-1.5 text-primary text-[11px]">
                            <Filter className="h-3 w-3" />
                            Backend SQL Filters Active
                        </span>
                    )}
                </div>
            </div>

            {/* ── Test Grid ── */}
            <div className="relative">
                {isFilterPending && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
                        <Loader size="lg" />
                    </div>
                )}
                {displayItems.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center bg-card">
                    <p className="text-muted-foreground text-sm">
                        {activeTab === "organization"
                            ? "No private organization tests found for your account or batch."
                            : "No tests match your filter criteria."}
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 gap-2 text-xs" onClick={clearFilters}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset filters
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {displayItems.map((t) => {
                        const existingAttempt = attemptBySeriesId.get(t.id);
                        const isInProgress = existingAttempt?.status === "in_progress" || existingAttempt?.status === 0;
                        const isSubmitted = existingAttempt?.status === "submitted" || existingAttempt?.status === 2 || existingAttempt?.status === 3;
                        const isExpired = new Date(t.valid_until) < new Date();
                        const orgName = t.org_id === 0 ? "Safalya" : organizations[t.org_id] ?? `Organization #${t.org_id}`;

                        return (
                            <Card key={t.id} className="relative overflow-hidden flex flex-col justify-between">
                                {/* Accent stripe */}
                                <div
                                    className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${
                                        isExpired ? "bg-muted" : "bg-primary"
                                    }`}
                                />

                                <CardHeader className="pl-5 pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-xl leading-snug">{t.name}</CardTitle>
                                        {isExpired && (
                                            <Badge variant="outline" className="shrink-0 text-muted-foreground">
                                                Expired
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription>
                                        {t.question_count} question{t.question_count !== 1 ? "s" : ""} ·{" "}
                                        {formatDuration(t.duration_seconds)} ·{" "}
                                        <span className="font-semibold text-orange">{orgName}</span>
                                    </CardDescription>

                                    {/* Topic Badges */}
                                    {t.topics && t.topics.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-2">
                                            {t.topics.map((tp) => (
                                                <Badge
                                                    key={tp}
                                                    variant="outline"
                                                    className="text-[13px] font-normal bg-muted/40 gap-1 text-muted-foreground p-2.5"
                                                >
                                                    <Tag className="h-3 w-3 text-primary/70 pb-0.5" />
                                                    {tp}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </CardHeader>

                                <CardContent className="pl-5 space-y-3">
                                    <p className="text-muted-foreground text-sm" suppressHydrationWarning>
                                        Available until {new Date(t.valid_until).toLocaleString()}
                                    </p>

                                    {/* Score display for submitted attempts */}
                                    {isSubmitted && existingAttempt && (
                                        <p className="text-sm font-medium">
                                            Score:{" "}
                                            <span className="text-primary">
                                                {existingAttempt.score} / {existingAttempt.total_marks}
                                            </span>
                                        </p>
                                    )}

                                    {/* Action button */}
                                    {isInProgress ? (
                                        <Button
                                            className="w-full"
                                            onClick={() => router.push(`/student/attempts/${existingAttempt!.id}`)}
                                        >
                                            Resume test →
                                        </Button>
                                    ) : isSubmitted ? (
                                        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href={`/student/attempts/${existingAttempt!.id}`} />}>
                                            View results
                                        </Button>
                                    ) : (
                                        <Button
                                            className="w-full"
                                            disabled={busy === t.id || isExpired}
                                            onClick={() => {
                                                setPendingTestId(t.id);
                                                setInstructionsAccepted(false);
                                            }}
                                        >
                                            {busy === t.id ? "Starting…" : isExpired ? "Expired" : "Start test"}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
            </div>

            {/* ── Pagination Footer ── */}
            {paginatedTests.total_pages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                        Showing page <span className="font-semibold text-foreground">{paginatedTests.page}</span> of{" "}
                        <span className="font-semibold text-foreground">{paginatedTests.total_pages}</span> (
                        <span className="font-semibold">{paginatedTests.total}</span> total tests)
                    </p>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={paginatedTests.page <= 1}
                            onClick={() => handlePageChange(paginatedTests.page - 1)}
                            className="h-8 gap-1 text-xs"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: paginatedTests.total_pages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={page === paginatedTests.page ? "default" : "outline"}
                                    size="icon"
                                    onClick={() => handlePageChange(page)}
                                    className="h-8 w-8 text-xs"
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={paginatedTests.page >= paginatedTests.total_pages}
                            onClick={() => handlePageChange(paginatedTests.page + 1)}
                            className="h-8 gap-1 text-xs"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}


