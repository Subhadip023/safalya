"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { sanitizeHtmlContent } from "@/lib/sanitize";
import {
    ArrowLeft,
    Search,
    Users,
    CheckCircle2,
    Clock,
    Trophy,
    ExternalLink,
    X,
    Filter,
    Copy,
    QrCode,
    Eye,
    Loader2,
    Check,
    AlertCircle,
    FileText,
    Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AnswerSheetPdfModal from "@/components/answer-sheet-pdf-modal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import QRCodeModal from "../../qr-code-modal";
import PublishResultsModal from "./publish-results-modal";
import type { TestSeriesResults, TestSeriesResultItem } from "../../../services/test-series";

function formatDateTime(dateStr: string | null | undefined, fallback = "Not submitted"): string {
    if (!dateStr) return fallback;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return fallback;
        return d.toLocaleString();
    } catch {
        return fallback;
    }
}

export default function ResultsViewer({
    initialResults,
}: {
    initialResults: TestSeriesResults;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "force_submitted" | "in_progress" | "expired">("all");
    const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "date_desc" | "name_asc">("date_desc");
    const [isQROpen, setIsQROpen] = useState(false);
    const [selectedAttemptItem, setSelectedAttemptItem] = useState<TestSeriesResultItem | null>(null);
    const [origin, setOrigin] = useState("");

    const [isPublished, setIsPublished] = useState<boolean>(
        Boolean(initialResults.is_result_show && initialResults.is_score_show)
    );
    const [isPublishing, setIsPublishing] = useState(false);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [publishModalInitialStep, setPublishModalInitialStep] = useState<"decision" | "upload">("decision");
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfKey, setPdfKey] = useState<string | null | undefined>(
        initialResults.answer_key?.path || initialResults.result_file_key
    );

    useEffect(() => {
        if (typeof window !== "undefined") setOrigin(window.location.origin);
    }, []);

    async function handleTogglePublish() {
        setIsPublishing(true);
        try {
            const nextState = !isPublished;
            const res = await fetch(`/api/backend/test-series/${initialResults.series_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    is_result_show: nextState,
                    is_score_show: nextState,
                }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Failed to update publication status");
            }
            setIsPublished(nextState);
            if (nextState) {
                toast.success("Results & Scores published to students successfully!");
            } else {
                toast.info("Results & Scores hidden from students.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to publish results");
        } finally {
            setIsPublishing(false);
        }
    }

    async function handleDeletePdf() {
        const res = await fetch(`/api/backend/test-series/${initialResults.series_id}/result-sheet`, {
            method: "DELETE",
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Failed to delete answer sheet PDF");
        }
        setPdfKey(null);
    }

    async function handleReplacePdf(newFile: File) {
        const formData = new FormData();
        formData.append("file", newFile);
        const res = await fetch(`/api/backend/test-series/${initialResults.series_id}/result-sheet`, {
            method: "POST",
            body: formData,
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Failed to replace answer sheet PDF");
        }
        const data = await res.json();
        const newPath = data.path || `uploads/results/series_${initialResults.series_id}/result.pdf`;
        setPdfKey(newPath);
        return newPath;
    }

    // Filter and sort results
    const filteredResults = useMemo(() => {
        const list = initialResults.results.filter((item) => {
            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = item.student_name.toLowerCase().includes(q);
                const emailMatch = item.student_email.toLowerCase().includes(q);
                if (!nameMatch && !emailMatch) return false;
            }

            // Status filter
            if (statusFilter !== "all") {
                const isSub = item.status === "submitted" || String(item.status) === "2";
                const isForce = item.status === "force_submitted" || String(item.status) === "3";
                const isInProg = item.status === "in_progress" || String(item.status) === "0";
                const isExp = item.status === "expired" || String(item.status) === "1";

                if (statusFilter === "submitted" && !isSub) return false;
                if (statusFilter === "force_submitted" && !isForce) return false;
                if (statusFilter === "in_progress" && !isInProg) return false;
                if (statusFilter === "expired" && !isExp) return false;
            }

            return true;
        });

        // Sorting
        return list.sort((a, b) => {
            if (sortBy === "score_desc") return b.score - a.score;
            if (sortBy === "score_asc") return a.score - b.score;
            if (sortBy === "name_asc") return a.student_name.localeCompare(b.student_name);
            return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
        });
    }, [initialResults.results, searchQuery, statusFilter, sortBy]);

    // Top score calculation
    const topScore = useMemo(() => {
        if (initialResults.results.length === 0) return 0;
        return Math.max(...initialResults.results.map((r) => r.score));
    }, [initialResults.results]);

    const isFilterActive = searchQuery.trim() !== "" || statusFilter !== "all" || sortBy !== "date_desc";

    function clearFilters() {
        setSearchQuery("");
        setStatusFilter("all");
        setSortBy("date_desc");
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            {/* Header & Back Button */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href="/test-series" />}
                        className="mb-2 h-8 text-xs gap-1.5 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Test Series
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">{initialResults.series_name}</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Student attempt history, scores, and performance analytics.
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    {isPublished && pdfKey ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPdfModalOpen(true)}
                            className="h-9 text-xs gap-1.5 font-medium border-primary/20 hover:bg-primary/5 cursor-pointer"
                        >
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            View Answer Sheet
                        </Button>
                    ) : isPublished && !pdfKey ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setPublishModalInitialStep("upload");
                                setIsPublishModalOpen(true);
                            }}
                            className="h-9 text-xs gap-1.5 font-medium border-primary/20 hover:bg-primary/5 hover:text-primary cursor-pointer"
                        >
                            <Upload className="h-3.5 w-3.5 text-primary" />
                            Upload Answer Key
                        </Button>
                    ) : null}
                    <Button
                        variant={isPublished ? "outline" : "default"}
                        size="sm"
                        disabled={isPublishing}
                        onClick={isPublished ? handleTogglePublish : () => {
                            setPublishModalInitialStep("decision");
                            setIsPublishModalOpen(true);
                        }}
                        className={`h-9 text-xs gap-1.5 font-medium cursor-pointer ${
                            isPublished
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        }`}
                    >
                        {isPublishing ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Updating...
                            </>
                        ) : isPublished ? (
                            <>
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                Results Published
                            </>
                        ) : (
                            <>
                                <Eye className="h-3.5 w-3.5" />
                                Publish Results
                            </>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const tokenToShare = initialResults.invite_token || String(initialResults.series_id);
                            const url = `${origin || (typeof window !== "undefined" ? window.location.origin : "")}/student/join#token=${tokenToShare}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Invite link copied to clipboard!");
                        }}
                        className="h-9 text-xs gap-1.5 font-medium"
                    >
                        <Copy className="h-3.5 w-3.5 text-primary" />
                        Copy Invite Link
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsQROpen(true)}
                        className="h-9 text-xs gap-1.5 font-medium"
                    >
                        <QrCode className="h-3.5 w-3.5 text-primary" />
                        QR Code
                    </Button>
                </div>
            </div>

            <QRCodeModal
                isOpen={isQROpen}
                onClose={() => setIsQROpen(false)}
                seriesName={initialResults.series_name}
                inviteToken={initialResults.invite_token || String(initialResults.series_id)}
                origin={origin}
            />

            {/* Publication Banner */}
            {!isPublished ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300 text-xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>
                            <strong>Results are currently hidden from students.</strong> Students will not see scores or answer keys until you publish.
                        </span>
                    </div>
                    <Button
                        size="sm"
                        disabled={isPublishing}
                        onClick={() => setIsPublishModalOpen(true)}
                        className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-medium cursor-pointer"
                    >
                        Publish Results Now
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 text-xs">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                            <strong>Results published!</strong> Students can now view their marks and detailed answer keys in their portal.
                        </span>
                    </div>
                </div>
            )}



            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Total Students Attempted</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{initialResults.total_attempts}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total student attempts started</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Completed Submissions</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {initialResults.completed_attempts}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {initialResults.total_attempts > 0
                                ? `${Math.round((initialResults.completed_attempts / initialResults.total_attempts) * 100)}% completion rate`
                                : "No attempts yet"}
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Average Score</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{initialResults.average_score}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all completed attempts</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-medium text-muted-foreground">Highest Score</CardTitle>
                        <Trophy className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{topScore}</div>
                        <p className="text-xs text-muted-foreground mt-1">Best performance achieved</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Bar */}
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search student name / email */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by student name or email..."
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

                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
                    >
                        <option value="all">All Statuses</option>
                        <option value="submitted">Completed (Normal)</option>
                        <option value="force_submitted">Force Submitted</option>
                        <option value="in_progress">In Progress</option>
                        <option value="expired">Expired</option>
                    </select>

                    {/* Sort Order */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                    >
                        <option value="date_desc">Newest Attempt First</option>
                        <option value="score_desc">Highest Score</option>
                        <option value="score_asc">Lowest Score</option>
                        <option value="name_asc">Student Name (A-Z)</option>
                    </select>

                    {/* Clear Filters */}
                    {isFilterActive && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-9 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear filters
                        </Button>
                    )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span>
                        Showing <strong className="text-foreground font-semibold">{filteredResults.length}</strong> of{" "}
                        <strong className="text-foreground font-semibold">{initialResults.results.length}</strong> student attempts
                    </span>
                    {isFilterActive && (
                        <span className="flex items-center gap-1.5 text-primary text-[11px]">
                            <Filter className="h-3 w-3" />
                            Filters active
                        </span>
                    )}
                </div>
            </div>

            {/* Results Table */}
            {filteredResults.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center bg-card">
                    <p className="text-muted-foreground text-sm">No student attempts found for this test series.</p>
                    {isFilterActive && (
                        <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>
            ) : (
                <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="px-4 py-3 min-w-[200px]">Student</TableHead>
                                <TableHead className="px-4 py-3 w-32">Status</TableHead>
                                <TableHead className="px-4 py-3 w-40">Score & Marks</TableHead>
                                <TableHead className="px-4 py-3 w-36">Percentage</TableHead>
                                <TableHead className="px-4 py-3 w-44">Started At</TableHead>
                                <TableHead className="px-4 py-3 w-44">Submitted At</TableHead>
                                <TableHead className="px-4 py-3 w-28 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                            {filteredResults.map((item) => {
                                const isSubmitted = item.status === "submitted" || String(item.status) === "2";
                                const isForceSubmitted = item.status === "force_submitted" || String(item.status) === "3";
                                const isInProgress = item.status === "in_progress" || String(item.status) === "0";
                                const isExpiredItem = item.status === "expired" || String(item.status) === "1";
                                const isFinished = isSubmitted || isForceSubmitted;

                                // Badge color based on percentage
                                let pctBadgeColor = "bg-muted text-muted-foreground";
                                if (isFinished) {
                                    if (item.percentage >= 70) pctBadgeColor = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
                                    else if (item.percentage >= 40) pctBadgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
                                    else pctBadgeColor = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
                                }

                                return (
                                    <TableRow key={item.attempt_id} className="hover:bg-muted/10 transition-colors">
                                        {/* Student Info */}
                                        <TableCell className="px-4 py-3.5">
                                            <div className="font-medium text-foreground">{item.student_name}</div>
                                            <div className="text-muted-foreground text-[11px] font-mono">{item.student_email}</div>
                                        </TableCell>

                                        {/* Status */}
                                        <TableCell className="px-4 py-3.5">
                                            {isForceSubmitted ? (
                                                <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20 font-medium">
                                                    Force Submitted
                                                </Badge>
                                            ) : isSubmitted ? (
                                                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none">
                                                    Completed
                                                </Badge>
                                            ) : isInProgress ? (
                                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-none">
                                                    In progress
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">{isExpiredItem ? "Expired" : String(item.status)}</Badge>
                                            )}
                                        </TableCell>

                                        {/* Score */}
                                        <TableCell className="px-4 py-3.5 font-medium">
                                            {isSubmitted ? (
                                                <span>
                                                    <strong className="text-primary text-sm font-bold">{item.score}</strong> / {item.total_marks}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>

                                        {/* Percentage */}
                                        <TableCell className="px-4 py-3.5">
                                            {isSubmitted ? (
                                                <Badge variant="outline" className={`font-semibold ${pctBadgeColor}`}>
                                                    {item.percentage}%
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>

                                        {/* Dates */}
                                        <TableCell className="px-4 py-3.5 text-muted-foreground" suppressHydrationWarning>
                                            {formatDateTime(item.started_at)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 text-muted-foreground" suppressHydrationWarning>
                                            {formatDateTime(item.submitted_at, "Not submitted")}
                                        </TableCell>

                                         {/* Action */}
                                         <TableCell className="px-4 py-3.5 text-right">
                                             <Button
                                                 variant="outline"
                                                 size="sm"
                                                 onClick={() => setSelectedAttemptItem(item)}
                                                 className="h-8 text-xs gap-1.5 font-medium cursor-pointer"
                                                 title="View student choices and attempt details"
                                             >
                                                 <Eye className="h-3.5 w-3.5 text-primary" />
                                                 View Responses
                                             </Button>
                                         </TableCell>
                                     </TableRow>
                                 );
                             })}
                         </TableBody>
                     </Table>
                 </div>
             )}

            {/* Student Attempt Modal */}
            {selectedAttemptItem && (
                <StudentAttemptModal
                    item={selectedAttemptItem}
                    onClose={() => setSelectedAttemptItem(null)}
                />
            )}

            {/* Publish Results Modal */}
            <PublishResultsModal
                isOpen={isPublishModalOpen}
                onClose={() => setIsPublishModalOpen(false)}
                seriesId={initialResults.series_id}
                onPublish={handleTogglePublish}
                onPdfUploaded={(key) => setPdfKey(key)}
                initialStep={publishModalInitialStep}
                isAlreadyPublished={isPublished}
            />

            {/* Answer Sheet PDF Modal */}
            {isPdfModalOpen && pdfKey && (
                <AnswerSheetPdfModal
                    pdfUrl={pdfKey}
                    isAdmin={true}
                    onClose={() => setIsPdfModalOpen(false)}
                    onDelete={handleDeletePdf}
                    onReplace={handleReplacePdf}
                />
            )}
        </div>
    );
}

function StudentAttemptModal({
    item,
    onClose,
}: {
    item: TestSeriesResultItem;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [attemptData, setAttemptData] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        async function fetchAttempt() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/backend/student/attempts/${item.attempt_id}`);
                const data = await res.json();
                if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Failed to load attempt details.");
                if (isMounted) setAttemptData(data);
            } catch (err: any) {
                if (isMounted) setError(err.message || "Failed to load attempt.");
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchAttempt();
        return () => {
            isMounted = false;
        };
    }, [item.attempt_id]);

    const questions: any[] = attemptData?.questions ?? [];
    const totalQuestions = questions.length;
    const correctCount = questions.filter(
        (q) => q.correct_option_id != null && q.selected_option_id != null && String(q.selected_option_id) === String(q.correct_option_id),
    ).length;
    const incorrectCount = questions.filter(
        (q) => q.selected_option_id != null && String(q.selected_option_id) !== String(q.correct_option_id),
    ).length;
    const unansweredCount = questions.filter((q) => q.selected_option_id === null || q.selected_option_id === undefined).length;
    const isSubmitted = item.status === "submitted" || String(item.status) === "2";
    const isForceSubmitted = item.status === "force_submitted" || String(item.status) === "3";
    const isInProgress = item.status === "in_progress" || String(item.status) === "0";
    const isExpiredItem = item.status === "expired" || String(item.status) === "1";

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold">{item.student_name}</h3>
                            <Badge variant={isForceSubmitted ? "destructive" : isSubmitted ? "default" : "secondary"}>
                                {isForceSubmitted ? "Force Submitted" : isSubmitted ? "Submitted" : isInProgress ? "In Progress" : String(item.status)}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{item.student_email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-sm font-bold text-primary">
                                {item.score} / {item.total_marks} ({item.percentage}%)
                            </div>
                            <div className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                                {formatDateTime(item.submitted_at, "In progress")}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground cursor-pointer rounded-full p-1 hover:bg-accent transition-colors ml-2"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium">Loading student responses...</p>
                        </div>
                    ) : error ? (
                        <div className="py-12 text-center space-y-3">
                            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
                            <p className="text-sm font-medium text-destructive">{error}</p>
                            <Button variant="outline" size="sm" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Summary Chips */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="rounded-lg border bg-card p-3 text-center">
                                    <div className="text-xs text-muted-foreground font-medium">Total</div>
                                    <div className="text-lg font-bold mt-0.5">{totalQuestions}</div>
                                </div>
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                        Correct
                                    </div>
                                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        {correctCount}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                                    <div className="text-xs text-destructive font-medium">Incorrect</div>
                                    <div className="text-lg font-bold text-destructive mt-0.5">
                                        {incorrectCount}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
                                    <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                        Unanswered
                                    </div>
                                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                        {unansweredCount}
                                    </div>
                                </div>
                            </div>

                            {/* Questions list */}
                            <div className="space-y-4">
                                {questions.map((q: any) => {
                                    const isCorrect =
                                        q.correct_option_id != null && q.selected_option_id != null && String(q.selected_option_id) === String(q.correct_option_id);
                                    const isUnanswered = q.selected_option_id === null || q.selected_option_id === undefined;

                                    return (
                                        <Card key={q.id} className="border shadow-xs overflow-hidden">
                                            <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/60">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="text-sm font-semibold flex items-start gap-2">
                                                        <span className="text-primary font-bold">{q.position}.</span>
                                                        <span
                                                            dangerouslySetInnerHTML={{
                                                                __html: sanitizeHtmlContent(q.question),
                                                            }}
                                                        />
                                                        {q.diagrams && q.diagrams.length > 0 ? (
                                                            <div className="mt-2 flex flex-wrap gap-3">
                                                                {q.diagrams.map((d: any) => (
                                                                    <img
                                                                        key={d.id}
                                                                        src={`/api/backend/${d.path}`}
                                                                        alt="Question Diagram"
                                                                        className="max-h-72 max-w-full rounded border bg-background p-1.5 object-contain shadow-xs"
                                                                    />
                                                                ))}
                                                            </div>
                                                        ) : q.diagram_path ? (
                                                            <div className="mt-2">
                                                                <img
                                                                    src={`/api/backend/${q.diagram_path}`}
                                                                    alt="Question Diagram"
                                                                    className="max-h-72 max-w-full rounded border bg-background p-1.5 object-contain shadow-xs"
                                                                />
                                                            </div>
                                                        ) : null}
                                                        <span className="text-xs text-muted-foreground font-normal whitespace-nowrap">
                                                            ({q.marks} mark{q.marks !== "1.00" ? "s" : ""})
                                                        </span>
                                                    </div>
                                                    <div>
                                                        {isUnanswered ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs"
                                                            >
                                                                Unanswered
                                                            </Badge>
                                                        ) : isCorrect ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
                                                            >
                                                                ✓ Correct (+{q.marks})
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-destructive/40 bg-destructive/10 text-destructive text-xs"
                                                            >
                                                                ✗ Incorrect {q.negative_marks && Number(q.negative_marks) > 0 ? `(-${q.negative_marks})` : "(0)"}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-2">
                                                {q.options.map((opt: any) => {
                                                    const isSelected = q.selected_option_id != null && String(q.selected_option_id) === String(opt.id);
                                                    const isOptCorrect = q.correct_option_id != null && String(q.correct_option_id) === String(opt.id);

                                                    let optionStyle = "border-border/60 bg-card";
                                                    if (isOptCorrect) {
                                                        optionStyle =
                                                            "border-emerald-500/80 bg-emerald-500/10 font-medium text-emerald-950 dark:text-emerald-200";
                                                    } else if (isSelected && !isOptCorrect) {
                                                        optionStyle =
                                                            "border-destructive/80 bg-destructive/10 text-destructive";
                                                    }

                                                    return (
                                                        <div
                                                            key={opt.id}
                                                            className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-xs transition-colors ${optionStyle}`}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                {isOptCorrect ? (
                                                                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 font-bold" />
                                                                ) : isSelected ? (
                                                                    <X className="h-4 w-4 text-destructive shrink-0 font-bold" />
                                                                ) : (
                                                                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                                                                )}
                                                                <div className="flex flex-col gap-1.5">
                                                                    <span
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: sanitizeHtmlContent(opt.ans),
                                                                        }}
                                                                    />
                                                                    {opt.diagram_path && (
                                                                        <div>
                                                                            <img
                                                                                src={`/api/backend/${opt.diagram_path}`}
                                                                                alt="Option Diagram"
                                                                                className="max-h-36 max-w-full rounded border bg-background p-1 object-contain shadow-xs"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Choice indicator badge */}
                                                            {isSelected && isOptCorrect && (
                                                                <Badge className="bg-emerald-600 text-white dark:bg-emerald-500 text-[10px] shrink-0">
                                                                    ✓ Student's Choice (Correct)
                                                                </Badge>
                                                            )}
                                                            {isSelected && !isOptCorrect && (
                                                                <Badge
                                                                    variant="destructive"
                                                                    className="text-[10px] shrink-0"
                                                                >
                                                                    ✗ Student's Choice (Incorrect)
                                                                </Badge>
                                                            )}
                                                            {!isSelected && isOptCorrect && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="border-emerald-500 text-emerald-600 dark:text-emerald-400 text-[10px] shrink-0"
                                                                >
                                                                    ✓ Correct Option
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/student/attempts/${item.attempt_id}`} target="_blank" />}
                        className="text-xs gap-1.5"
                    >
                        <span>Full Attempt View</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="default" size="sm" onClick={onClose} className="text-xs cursor-pointer">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}


