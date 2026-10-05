"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { sanitizeHtmlContent } from "@/lib/sanitize";
import { Search, ChevronLeft, ChevronRight, Edit3, Trash2, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from "@/components/ui/table";
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
import Loader from "@/components/loader";
import type { Question, PaginatedQuestionResponse } from "../services/questions";
import { useTopics } from "@/lib/query/topics/use-topics";

type QuestionsTableProps = {
    initialData: PaginatedQuestionResponse;
    initialUsers: Record<number, string>;
    initialOrganizations: Record<number, string>;
    userRole: string;
};

export default function QuestionsTable({
    initialData,
    initialUsers,
    initialOrganizations,
    userRole,
}: QuestionsTableProps) {
    const { data: topics = [] } = useTopics();
    const [questions, setQuestions] = useState<Question[]>(initialData.items);
    const [total, setTotal] = useState(initialData.total);
    const [totalPages, setTotalPages] = useState(initialData.total_pages);
    const [currentPage, setCurrentPage] = useState(initialData.page);
    const [pageSize, setPageSize] = useState(initialData.page_size);
    const [selectedTopicId, setSelectedTopicId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [deletingQuestionId, setDeletingQuestionId] = useState<number | null>(null);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
    
    // Bulk action state
    const [bulkTopicId, setBulkTopicId] = useState("");
    const [bulkMarks, setBulkMarks] = useState("");
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    // Track user/org names across pages
    const [users] = useState<Record<number, string>>(initialUsers);
    const [organizations] = useState<Record<number, string>>(initialOrganizations);

    // Debounce ref for search
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch a page from the Next.js API proxy ───────────────────────
    const fetchPage = useCallback(async (page: number, size: number, topicId: string, search: string) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: String(size) });
            if (topicId) params.set("topic_id", topicId);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/questions?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch questions.");

            const data: PaginatedQuestionResponse = await res.json();
            setQuestions(data.items);
            setTotal(data.total);
            setTotalPages(data.total_pages);
            setCurrentPage(data.page);
        } catch {
            toast.error("Failed to load questions.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ── Page change ───────────────────────────────────────────────────
    const goToPage = (page: number) => {
        fetchPage(page, pageSize, selectedTopicId, searchQuery);
    };

    // ── Page size change ──────────────────────────────────────────────
    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        fetchPage(1, size, selectedTopicId, searchQuery);
    };

    // ── Topic filter ──────────────────────────────────────────────────
    const handleTopicChange = (topicId: string) => {
        setSelectedTopicId(topicId);
        fetchPage(1, pageSize, topicId, searchQuery);
    };

    // ── Debounced search → backend ────────────────────────────────────
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            fetchPage(1, pageSize, selectedTopicId, value);
        }, 400);
    };

    // Cleanup debounce on unmount
    useEffect(() => () => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }, []);


    async function deleteQuestion(questionId: number) {
        if (!window.confirm(`Permanently delete question #${questionId}? This cannot be undone.`)) return;
        setDeletingQuestionId(questionId);
        try {
            const response = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
            if (!response.ok) {
                const result = await response.json().catch(() => null) as { message?: string } | null;
                throw new Error(result?.message ?? "Unable to delete question.");
            }
            setQuestions((current) => current.filter((q) => q.id !== questionId));
            setTotal((t) => t - 1);
            toast.success("Question deleted.");
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Unable to delete question.");
        } finally {
            setDeletingQuestionId(null);
        }
    }

    // ── Checkbox Selection ──────────────────────────────────────────────
    const visibleQuestionIds = questions.map((q) => q.id);
    const isAllSelected = visibleQuestionIds.length > 0 && visibleQuestionIds.every(id => selectedQuestionIds.includes(id));
    const isIndeterminate = !isAllSelected && visibleQuestionIds.some(id => selectedQuestionIds.includes(id));

    const toggleSelectAll = (checked: boolean | "indeterminate") => {
        if (checked === true) {
            // Select all visible questions
            setSelectedQuestionIds(prev => {
                const newIds = new Set(prev);
                visibleQuestionIds.forEach(id => newIds.add(id));
                return Array.from(newIds);
            });
        } else {
            // Deselect all visible questions
            setSelectedQuestionIds(prev => prev.filter(id => !visibleQuestionIds.includes(id)));
        }
    };

    const toggleQuestionSelect = (id: number) => {
        setSelectedQuestionIds(prev => 
            prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
        );
    };

    // ── Bulk Actions ────────────────────────────────────────────────────
    const canBulkUpdate = selectedQuestionIds.length > 0 && (bulkTopicId !== "" || bulkMarks !== "");

    const handleBulkUpdate = async () => {
        setIsBulkUpdating(true);
        try {
            const payload: any = { question_ids: selectedQuestionIds };
            if (bulkTopicId) payload.topic_id = Number(bulkTopicId);
            if (bulkMarks) payload.marks = parseFloat(bulkMarks);

            const res = await fetch("/api/backend/questions/bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.message || errorData?.detail || "Bulk update failed.");
            }

            const result = await res.json();
            toast.success(result.message || `${selectedQuestionIds.length} questions updated successfully.`);
            
            // Clear selection and fields
            setSelectedQuestionIds([]);
            setBulkTopicId("");
            setBulkMarks("");
            setIsBulkUpdateModalOpen(false);
            
            // Refresh current page
            fetchPage(currentPage, pageSize, selectedTopicId, searchQuery);
            
        } catch (error: any) {
            toast.error(error.message || "Failed to update questions");
        } finally {
            setIsBulkUpdating(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Controls ── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by ID, question text, or topic..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 pr-9 h-9 text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => handleSearchChange("")}
                                className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Topic filter */}
                    {topics.length > 0 && (
                        <select
                            value={selectedTopicId}
                            onChange={(e) => handleTopicChange(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring shrink-0 min-w-[140px]"
                        >
                            <option value="">All Topics</option>
                            {topics.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Bulk Actions */}
                    {selectedQuestionIds.length > 0 && (
                        <>
                            <div className="h-5 w-px bg-border mx-1"></div>
                            <select
                                value={bulkTopicId}
                                onChange={(e) => setBulkTopicId(e.target.value)}
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring shrink-0 min-w-[140px]"
                            >
                                <option value="">Select Topic</option>
                                {topics.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <Input
                                type="number"
                                placeholder="Marks"
                                value={bulkMarks}
                                onChange={(e) => setBulkMarks(e.target.value)}
                                className="h-9 w-24 text-sm"
                                min={0}
                                step={0.5}
                            />
                            <Button 
                                size="sm" 
                                variant="secondary"
                                className="h-9"
                                disabled={!canBulkUpdate || isBulkUpdating}
                                onClick={() => setIsBulkUpdateModalOpen(true)}
                            >
                                Update Questions
                            </Button>
                        </>
                    )}
                </div>

                {/* Page size + total */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                        {total.toLocaleString()} question{total !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="relative rounded-xl border bg-card overflow-hidden shadow-sm">
                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                        <Loader size="lg" />
                    </div>
                )}

                {questions.length === 0 && !isLoading ? (
                    <div className="p-12 text-center">
                        <p className="text-muted-foreground text-sm">No questions found matching your criteria.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="px-4 py-3 w-12 text-center">
                                    <Checkbox
                                        checked={isAllSelected}
                                        indeterminate={isIndeterminate}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Select all questions"
                                    />
                                </TableHead>
                                <TableHead className="px-4 py-3 w-16">ID</TableHead>
                                <TableHead className="px-4 py-3 min-w-[200px]">Question text</TableHead>
                                <TableHead className="px-4 py-3 w-28">Topic</TableHead>
                                <TableHead className="px-4 py-3 w-24">Marks</TableHead>
                                <TableHead className="px-4 py-3 w-24">Status</TableHead>
                                <TableHead className="px-4 py-3 w-40">Creator / Org</TableHead>
                                <TableHead className="px-4 py-3 w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-md">
                            {questions.map((q) => {
                                const plain = (q.question ?? q.title ?? "").replace(/<[^>]*>/g, "");
                                const creator = q.is_global ? "Global" : users[q.user_id] ?? `User #${q.user_id}`;
                                const org = q.is_global ? "" : organizations[q.organization_id] ?? `Org #${q.organization_id}`;

                                return (
                                    <TableRow key={q.id} className="hover:bg-muted/10 transition-colors">
                                        <TableCell className="px-4 py-3.5 text-center">
                                            <Checkbox
                                                checked={selectedQuestionIds.includes(q.id)}
                                                onCheckedChange={() => toggleQuestionSelect(q.id)}
                                                aria-label={`Select question ${q.id}`}
                                            />
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 font-mono text-muted-foreground">#{q.id}</TableCell>
                                        <TableCell className="px-4 py-3.5 max-w-md whitespace-normal">
                                            <div className="space-y-1.5">
                                                {q.diagram_path && (
                                                    <div className="flex items-center gap-1 text-xs text-blue-600 font-medium bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded w-fit">
                                                        <ImageIcon className="h-3 w-3" />
                                                        <span>Diagram</span>
                                                    </div>
                                                )}
                                                <div
                                                    className="text-md line-clamp-2 leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(q.question ?? q.title ?? "") }}
                                                    title={plain}
                                                />
                                                {q.options && q.options.length > 0 && (
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                                                        {q.options.slice(0, 4).map((opt, i) => {
                                                            const cleanAns = opt.ans ? opt.ans.replace(/<[^>]*>/g, "").trim() : "";
                                                            const label = cleanAns
                                                                ? `${cleanAns}${opt.diagram_path ? " [Diagram]" : ""}`
                                                                : (opt.diagram_path ? "[Diagram]" : "");
                                                            return (
                                                                <span
                                                                    key={opt.id ?? i}
                                                                    className={opt.is_correct ? "text-green-600 font-semibold" : ""}
                                                                >
                                                                    {String.fromCharCode(65 + i)}. {label}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5">
                                            {q.topic ? (
                                                <Badge
                                                    style={{ backgroundColor: q.topic.color, color: "#ffffff", borderColor: "transparent" }}
                                                    className="text-xs px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
                                                >
                                                    {q.topic.name}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground italic">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 font-semibold text-foreground whitespace-nowrap">
                                            {q.marks} marks
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5">
                                            <Badge variant={q.is_active ? "default" : "secondary"} className="text-xs">
                                                {q.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 text-muted-foreground leading-normal whitespace-nowrap">
                                            <div className="font-medium text-foreground">{creator}</div>
                                            {org && <div className="text-xs">{org}</div>}
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    nativeButton={false}
                                                    render={<Link href={`/questions/${q.id}`} />}
                                                    className="h-7 w-7"
                                                    title="Edit question"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </Button>
                                                {["0", "1", "2"].includes(userRole) && (
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                        title="Delete question"
                                                        disabled={deletingQuestionId === q.id}
                                                        onClick={() => deleteQuestion(q.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* ── Pagination Footer ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                        Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
                        <span className="font-semibold text-foreground">{totalPages}</span>
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={currentPage <= 1 || isLoading}
                            onClick={() => goToPage(currentPage - 1)}
                            className="h-8 w-8"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            disabled={currentPage >= totalPages || isLoading}
                            onClick={() => goToPage(currentPage + 1)}
                            className="h-8 w-8"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
            
            {/* Bulk Update Modal */}
            <AlertDialog open={isBulkUpdateModalOpen} onOpenChange={setIsBulkUpdateModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Bulk Update</AlertDialogTitle>
                        <AlertDialogDescription>
                            {bulkTopicId && !bulkMarks && `Do you want to change the topic of the selected questions to ${topics.find(t => String(t.id) === bulkTopicId)?.name}?`}
                            {!bulkTopicId && bulkMarks && `Do you want to change the marks of the selected questions to ${parseFloat(bulkMarks).toFixed(2)}?`}
                            {bulkTopicId && bulkMarks && `Do you want to update the topic to ${topics.find(t => String(t.id) === bulkTopicId)?.name} and marks to ${parseFloat(bulkMarks).toFixed(2)} for the selected questions?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBulkUpdating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => { e.preventDefault(); handleBulkUpdate(); }} 
                            disabled={isBulkUpdating}
                        >
                            {isBulkUpdating ? "Updating..." : "Update"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
